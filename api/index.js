const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

const SECRET_KEY = process.env.SECRET_KEY || 'ddcet_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Tushar:Tushar123%23@cluster0.xxdrret.mongodb.net/ddcet_hub';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==================== MIDDLEWARE ====================

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== MONGOOSE SCHEMAS ====================

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  full_name: { type: String, default: '' },
  phone: { type: String, default: '' },
  department: { type: String, default: '' },
  progress: { type: mongoose.Schema.Types.Mixed, default: {} },
  current_session_id: { type: String, default: '' },
  password_reset_token: { type: String, default: null },
  password_reset_expires: { type: Date, default: null },
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

const User = mongoose.models.User || mongoose.model('User', userSchema);
const LoginLog = mongoose.models.LoginLog || mongoose.model('LoginLog', loginLogSchema);

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

// DB connection middleware — runs before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    res.status(500).json({ message: 'Database connection failed. Please try again later.' });
  }
});

// ==================== HEALTH CHECK ====================

const handleHealth = (req, res) => res.json({ status: 'ok' });
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// ==================== SIGNUP ====================

const handleSignup = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const fullName = normalizeText(req.body.fullName);
    const phone = normalizePhone(req.body.phone);
    const department = normalizeText(req.body.department);

    const validationMessage = validateSignupPayload({ fullName, phone, department, email, password });
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered. Please sign in.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, full_name: fullName, phone, department });
    await newUser.save();
    return res.status(201).json({ message: 'Account created successfully! Please sign in.' });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Unable to create account right now. Please try again.' });
  }
};
app.post('/api/signup', handleSignup);
app.post('/signup', handleSignup);

// ==================== LOGIN ====================

const handleLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const device = req.headers['user-agent'] || 'Unknown Device';

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    user.current_session_id = sessionId;
    user.updated_at = new Date();
    await user.save();

    try {
      const loginLog = new LoginLog({ user_id: user._id, email, ip, device });
      await loginLog.save();
    } catch (_) { /* non-critical */ }

    const token = jwt.sign({ email: user.email, sessionId }, SECRET_KEY, { expiresIn: '24h' });
    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};
app.post('/api/login', handleLogin);
app.post('/login', handleLogin);

// ==================== VERIFY TOKEN ====================

const handleVerify = (req, res) => {
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
};
app.post('/api/verify', handleVerify);
app.post('/verify', handleVerify);

// ==================== SAVE PROGRESS ====================

const handleSaveProgress = (req, res) => {
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
};
app.post('/api/save-progress', handleSaveProgress);
app.post('/save-progress', handleSaveProgress);

// ==================== GET PROGRESS ====================

const handleGetProgress = (req, res) => {
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
};
app.post('/api/get-progress', handleGetProgress);
app.post('/get-progress', handleGetProgress);

// ==================== FORGOT PASSWORD ====================

const handleForgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({ email });
    // Always return success to avoid exposing which emails exist
    if (!user) return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });

    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    console.log(`Password reset token for ${email}: ${resetToken}`);
    return res.status(200).json({ 
      message: 'Password reset link generated.',
      devResetLink: `reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process request.' });
  }
};
app.post('/api/forgot-password', handleForgotPassword);
app.post('/forgot-password', handleForgotPassword);

// ==================== RESET PASSWORD ====================

const handleResetPassword = async (req, res) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      return res.status(400).json({ message: 'Token, email, and new password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || user.password_reset_token !== token) {
      return res.status(401).json({ message: 'Invalid or expired reset token.' });
    }
    if (user.password_reset_expires && new Date() > user.password_reset_expires) {
      return res.status(401).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.current_session_id = '';
    user.updated_at = new Date();
    await user.save();

    return res.status(200).json({ message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password.' });
  }
};
app.post('/api/reset-password', handleResetPassword);
app.post('/reset-password', handleResetPassword);

module.exports = app;
