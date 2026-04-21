// auth.js - Client-side authentication logic

const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1' ||
    window.location.protocol === 'file:';
const API_BASE_URL = isLocal ? 'http://localhost:5001/api' : 'https://ddcet-hub-backend.onrender.com/api';

/**
 * Check if the user is authenticated.
 * Redirects to login.html if not.
 */
async function checkAuth() {
    const token = localStorage.getItem('ddcet_token');
    
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (!data.valid) {
            localStorage.removeItem('ddcet_token');
            redirectToLogin();
        } else {
            console.log('Authenticated as:', data.user.email);
            updateUIForAuthenticatedUser(data.user.email);
        }
    } catch (err) {
        console.error('Auth check failed:', err);
    }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
    window.location.href = 'login.html';
}

/**
 * Logout the user
 */
function logout() {
    localStorage.removeItem('ddcet_token');
    window.location.href = 'login.html';
}

/**
 * Shared auth badge mount point for guest/authenticated states
 */
function mountAuthSection(content) {
    const header = document.querySelector('.header');
    if (!header) {
        return;
    }

    let authSection = document.getElementById('auth-section');
    if (!authSection) {
        authSection = document.createElement('div');
        authSection.id = 'auth-section';
        authSection.style.display = 'flex';
        authSection.style.gap = '10px';
        authSection.style.alignItems = 'center';
        authSection.style.fontSize = '12px';
        header.appendChild(authSection);
    }

    authSection.innerHTML = content;
}

/**
 * Update UI with user info and logout button
 */
function updateUIForAuthenticatedUser(email) {
    mountAuthSection(`
        <span style="color: #94a3b8">${email}</span>
        <button onclick="logout()" style="
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.2);
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
        ">Logout</button>
    `);
}

/**
 * Save user progress to the backend
 */
async function syncProgress(progress) {
    const token = localStorage.getItem('ddcet_token');
    if (!token) return;

    try {
        await fetch(`${API_BASE_URL}/save-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, progress })
        });
    } catch (err) {
        console.error('Failed to sync progress:', err);
    }
}

/**
 * Load user progress from the backend
 */
async function fetchProgress() {
    const token = localStorage.getItem('ddcet_token');
    if (!token) return {};

    try {
        const response = await fetch(`${API_BASE_URL}/get-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await response.json();
        return data.progress || {};
    } catch (err) {
        console.error('Failed to fetch progress:', err);
        return {};
    }
}

/**
 * Surgical patch for localStorage to enable automatic cloud sync
 */
(function patchLocalStorage() {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        originalSetItem.apply(this, arguments);
        if (key === 'ddcet-chip-states') {
            try {
                const states = JSON.parse(value);
                syncProgress(states);
            } catch (e) {}
        }
    };
})();

/**
 * Proactive Progress Load: Sync cloud data to local storage on startup
 */
async function startupSync() {
    if (window.location.pathname.endsWith('login.html')) return;
    
    const cloudProgress = await fetchProgress();
    if (Object.keys(cloudProgress).length > 0) {
        const localProgress = JSON.parse(localStorage.getItem('ddcet-chip-states') || '{}');
        const merged = Object.assign({}, localProgress, cloudProgress);
        localStorage.setItem('ddcet-chip-states', JSON.stringify(merged));
        
        // If the page already loaded chips, we might need a refresh 
        // but for now, the next time the user opens the page it will be perfect.
        // Actually, trigger a custom event that pages can listen to if they want
        window.dispatchEvent(new CustomEvent('ddcet-progress-synced'));
    }
}

// Run auth check and startup sync on load
if (window.location.pathname.split('/').pop() !== 'login.html') {
    document.addEventListener('DOMContentLoaded', () => {
        checkAuth();
        startupSync();
    });
}
