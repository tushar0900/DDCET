# DDCET 2026 Complete Study Hub

A premium, interactive study platform for DDCET 2026 aspirants.

## 🚀 Features
- **All-in-One Dashboard**: Access Mathematics, Chemistry, Physics, EVS, and English/Computer notes from a single interface.
- **Chapter-wise Breakdown**: Detailed notes with weightage, topic chips, and key rules.
- **Premium UI**: Modern dark-themed design with interactive sidebars and smooth navigation.
- **Gujlish Tips**: Special exam-focused tips provided in a "Gujlish" (Gujarati + English) format for better understanding.

## 🔐 Authentication & Backend
The platform now includes a secure authentication system:
- **Backend**: Node.js & Express server (located in `/backend`).
- **Database**: JSON-based user storage for simplicity.
- **Security**: JWT-based session management and Bcrypt password hashing.
- **Protection**: All subject pages are protected and require login.

### 🛠 How to Run Locally
1. **Start the Backend**:
   ```bash
   cd backend
   npm install
   node server.js
   ```
2. **Open the Frontend**:
   - Open `login.html` in your browser.
   - Register a new account or login with existing credentials.
   - Once authenticated, you'll be redirected to the Study Hub.

## 📂 Project Structure
- `index.html`: The main study hub (comprehensive SPA).
- `login.html`: Access control and user registration.
- `auth.js`: Shared authentication logic for all pages.
- `backend/`: Express server for authentication.
- Individual Subject Files: `chemistry.html`, `physics.html`, `evs.html`, `english&computer.html`.

## 🌐 Deployment
The frontend can be hosted on GitHub Pages, but the backend server must be hosted on a platform like Render, Heroku, or a VPS for the authentication to work live.

---
*Created with ❤️ for DDCET Aspirants.*
