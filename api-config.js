(() => {
    const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1' ||
        window.location.protocol === 'file:';

    const LOCAL_API_BASE_URL = 'http://localhost:5001/api';
    const DEFAULT_PROD_API_BASE_URL = 'https://ddcet-hub-backend.onrender.com/api';
    const STORAGE_KEY = 'ddcet_api_base_url';

    const safeStorageGet = (key) => {
        try {
            return localStorage.getItem(key) || '';
        } catch (_) {
            return '';
        }
    };

    const safeStorageSet = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (_) {}
    };

    const safeStorageRemove = (key) => {
        try {
            localStorage.removeItem(key);
        } catch (_) {}
    };

    const normalizeApiBase = (value = '') => {
        const trimmed = value.trim();
        if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
            return '';
        }

        const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
        return withoutTrailingSlash.endsWith('/api')
            ? withoutTrailingSlash
            : `${withoutTrailingSlash}/api`;
    };

    const getQueryOverride = () => {
        try {
            const params = new URLSearchParams(window.location.search);
            return normalizeApiBase(params.get('apiBase') || params.get('api') || '');
        } catch (_) {
            return '';
        }
    };

    const queryOverride = getQueryOverride();
    if (queryOverride) {
        safeStorageSet(STORAGE_KEY, queryOverride);
    }

    const getStoredApiBase = () => normalizeApiBase(safeStorageGet(STORAGE_KEY));

    const getApiBaseUrl = () => {
        if (isLocal) {
            return LOCAL_API_BASE_URL;
        }

        return queryOverride || getStoredApiBase() || DEFAULT_PROD_API_BASE_URL;
    };

    const setApiBaseUrl = (value) => {
        const normalized = normalizeApiBase(value);
        if (!normalized) {
            return '';
        }

        safeStorageSet(STORAGE_KEY, normalized);
        return normalized;
    };

    const clearApiBaseUrl = () => {
        safeStorageRemove(STORAGE_KEY);
    };

    const probeApiBase = async (baseUrl, timeoutMs = 8000) => {
        const normalized = normalizeApiBase(baseUrl);
        if (!normalized) {
            return { ok: false, status: 0, url: '' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${normalized}/health`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });

            return {
                ok: response.ok,
                status: response.status,
                url: normalized
            };
        } catch (error) {
            return {
                ok: false,
                status: 0,
                url: normalized,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            clearTimeout(timeoutId);
        }
    };

    window.DDCET_API_CONFIG = {
        isLocal,
        storageKey: STORAGE_KEY,
        defaultProdApiBaseUrl: DEFAULT_PROD_API_BASE_URL,
        getApiBaseUrl,
        getStoredApiBase,
        normalizeApiBase,
        setApiBaseUrl,
        clearApiBaseUrl,
        probeApiBase
    };
})();
