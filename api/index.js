const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', 'backend', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || 'ddcet_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ddcet_hub';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(cors());
app.use(bodyParser.json());

// ==================== MONGOOSE SCHEMAS ====================

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  full_name: { type: String, default: '' },
  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  progress: { type: mongoose.Schema.Types.Mixed, default: {} },
  current_session_id: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const loginLogSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  ip: { type: String, default: '' },
  device: { type: String, default: 'Unknown Device' },
  timestamp: { type: Date, default: Date.now },
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, default: '' },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const LoginLog = mongoose.models.LoginLog || mongoose.model('LoginLog', loginLogSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

// ==================== HELPERS ====================

const normalizeEmail = (v = '') => v.trim().toLowerCase();
const normalizeText = (v = '') => v.trim().replace(/\s+/g, ' ');
const normalizePhone = (v = '') => v.replace(/\D/g, '').slice(0, 10);

const validateSignupPayload = ({ fullName, phone, department, email, password }) => {
  if (fullName.length < 2) return 'Please enter your full name.';
  if (!EMAIL_PATTERN.test(email)) return 'Please enter a valid email address.';
  if (!/^\d{10}$/.test(phone)) return 'Please enter a valid 10-digit mobile number.';
  if (!department) return 'Please enter your department or branch.';
  if (password.length < 6) return 'Password must be at least 6 characters long.';
  return null;
};

const verifySession = async (decoded) => {
  try {
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.current_session_id !== decoded.sessionId) return false;
    return true;
  } catch (error) {
    return false;
  }
};

// ==================== DB CONNECTION ====================

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 15000,
    retryWrites: true,
  });
  isConnected = true;
};

// Middleware to ensure DB connection on every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed.' });
  }
});

// ==================== API ROUTES ====================

app.post('/api/signup', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const fullName = normalizeText(req.body.fullName);
    const phone = normalizePhone(req.body.phone);
    const department = normalizeText(req.body.department);

    const validationMessage = validateSignupPayload({ fullName, phone, department, email, password });
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, full_name: fullName, phone, department });
    await newUser.save();
    return res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Unable to create user right now.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const device = req.headers['user-agent'] || 'Unknown Device';

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    user.current_session_id = sessionId;
    user.updated_at = new Date();
    await user.save();

    const loginLog = new LoginLog({ user_id: user._id, email, ip, device });
    await loginLog.save();

    const token = jwt.sign({ email: user.email, sessionId }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

app.post('/api/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ valid: false });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ valid: false });
      const isValid = await verifySession(decoded);
      if (!isValid) return res.status(401).json({ valid: false, message: 'Session expired (logged in elsewhere)' });
      res.json({ valid: true, user: decoded });
    });
  } catch (error) {
    return res.status(500).json({ valid: false });
  }
});

app.post('/api/save-progress', async (req, res) => {
  try {
    const { token, progress } = req.body;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });

      const isValid = await verifySession(decoded);
      if (!isValid) return res.status(401).json({ message: 'Account logged in from another device' });

      const user = await User.findOne({ email: decoded.email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.progress = progress;
      user.updated_at = new Date();
      await user.save();
      res.json({ success: true });
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/get-progress', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });

      const user = await User.findOne({ email: decoded.email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      res.json({ progress: user.progress || {} });
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = app;
