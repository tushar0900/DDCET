const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const SECRET_KEY = 'ddcet_secret_key'; 
const DB_PATH = path.join(__dirname, 'database.sqlite');
const USERS_JSON = path.join(__dirname, 'users.json');

app.use(cors());
app.use(bodyParser.json());

// Initialize SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error(err.message);
  console.log('Connected to the SQLite database.');
});

// Create Table and Migrate Data if necessary
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    progress TEXT DEFAULT '{}',
    current_session_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    ip TEXT,
    device TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Basic Migration from JSON to SQLite
  if (fs.existsSync(USERS_JSON)) {
    try {
      const users = JSON.parse(fs.readFileSync(USERS_JSON));
      users.forEach(u => {
        db.run(`INSERT OR IGNORE INTO users (email, password, progress) VALUES (?, ?, ?)`, 
          [u.email, u.password, JSON.stringify(u.progress || {})]);
      });
      console.log('Migration from users.json completed.');
    } catch (e) {
      console.error('Migration failed:', e);
    }
  }
});

// Signup Route
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashedPassword], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: 'User already exists' });
      }
      return res.status(500).json({ message: err.message });
    }
    res.status(201).json({ message: 'User created' });
  });
});

// Login Route
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const device = req.headers['user-agent'] || 'Unknown Device';

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate a unique session ID for this specific login
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Update user's current session and Log the login
    db.run(`UPDATE users SET current_session_id = ? WHERE id = ?`, [sessionId, user.id]);
    db.run(`INSERT INTO login_logs (user_id, email, ip, device) VALUES (?, ?, ?, ?)`, 
      [user.id, email, ip, device]);

    // Include sessionId in the token
    const token = jwt.sign({ email: user.email, sessionId: sessionId }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token });
  });
});

// Helper to verify session validity
const verifySession = (decoded, callback) => {
  db.get(`SELECT current_session_id FROM users WHERE email = ?`, [decoded.email], (err, row) => {
    if (err || !row || row.current_session_id !== decoded.sessionId) {
      callback(false);
    } else {
      callback(true);
    }
  });
};

// Verify Token Route
app.post('/api/verify', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ valid: false });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ valid: false });
    
    verifySession(decoded, (isValid) => {
      if (!isValid) return res.status(401).json({ valid: false, message: 'Session expired (logged in elsewhere)' });
      res.json({ valid: true, user: decoded });
    });
  });
});

// Save Progress Route
app.post('/api/save-progress', (req, res) => {
  const { token, progress } = req.body;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    
    verifySession(decoded, (isValid) => {
      if (!isValid) return res.status(401).json({ message: 'Account logged in from another device' });

      db.run(`UPDATE users SET progress = ? WHERE email = ?`, [JSON.stringify(progress), decoded.email], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
      });
    });
  });
});

// Get Progress Route
app.post('/api/get-progress', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    db.get(`SELECT progress FROM users WHERE email = ?`, [decoded.email], (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!row) return res.status(404).json({ message: 'User not found' });
      res.json({ progress: JSON.parse(row.progress || '{}') });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
