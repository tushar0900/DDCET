require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

console.log('🔧 Initializing server...');

const app = express();
const PORT = process.env.PORT || 5001;
const SECRET_KEY = process.env.SECRET_KEY || 'ddcet_secret_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ddcet_hub';

console.log('📝 Configuration loaded:');
console.log(`   - PORT: ${PORT}`);
console.log(`   - MONGODB_URI: ${MONGODB_URI}`);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(cors());
app.use(bodyParser.json());

// ==================== MONGOOSE SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: EMAIL_PATTERN,
  },
  password: {
    type: String,
    required: true,
  },
  full_name: {
    type: String,
    default: '',
  },
  phone: {
    type: String,
    default: '',
  },
  department: {
    type: String,
    default: '',
  },
  progress: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  current_session_id: {
    type: String,
    default: '',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Login Log Schema
const loginLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  ip: {
    type: String,
    default: '',
  },
  device: {
    type: String,
    default: 'Unknown Device',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Settings Schema
const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: String,
    default: '',
  },
});

// ==================== MODELS ====================

const User = mongoose.model('User', userSchema);
const LoginLog = mongoose.model('LoginLog', loginLogSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ==================== HELPER FUNCTIONS ====================

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const normalizeText = (value = '') => value.trim().replace(/\s+/g, ' ');
const normalizePhone = (value = '') => value.replace(/\D/g, '').slice(0, 10);

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
    if (!user || user.current_session_id !== decoded.sessionId) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
};

// ==================== API ROUTES ====================

// Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const fullName = normalizeText(req.body.fullName);
    const phone = normalizePhone(req.body.phone);
    const department = normalizeText(req.body.department);

    const validationMessage = validateSignupPayload({
      fullName,
      phone,
      department,
      email,
      password,
    });

    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
      full_name: fullName,
      phone,
      department,
    });

    await newUser.save();
    return res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Unable to create user right now.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const device = req.headers['user-agent'] || 'Unknown Device';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate a unique session ID for this specific login
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Update user's current session
    user.current_session_id = sessionId;
    user.updated_at = new Date();
    await user.save();

    // Log the login
    const loginLog = new LoginLog({
      user_id: user._id,
      email,
      ip,
      device,
    });
    await loginLog.save();

    // Include sessionId in the token
    const token = jwt.sign({ email: user.email, sessionId }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// Verify Token Route
app.post('/api/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ valid: false });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ valid: false });

      const isValid = await verifySession(decoded);
      if (!isValid) {
        return res.status(401).json({
          valid: false,
          message: 'Session expired (logged in elsewhere)',
        });
      }

      res.json({ valid: true, user: decoded });
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ valid: false });
  }
});

// Save Progress Route
app.post('/api/save-progress', async (req, res) => {
  try {
    const { token, progress } = req.body;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });

      const isValid = await verifySession(decoded);
      if (!isValid) {
        return res.status(401).json({ message: 'Account logged in from another device' });
      }

      const user = await User.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      user.progress = progress;
      user.updated_at = new Date();
      await user.save();

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Save progress error:', error);
    return res.status(500).json({ message: error.message });
  }
});

// Get Progress Route
app.post('/api/get-progress', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid token' });

      const user = await User.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ progress: user.progress || {} });
    });
  } catch (error) {
    console.error('Get progress error:', error);
    return res.status(500).json({ message: error.message });
  }
});

// ==================== MONGOOSE CONNECTION ====================

const connectDatabase = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    console.log('✓ Connected to MongoDB');
    console.log(`✓ Database: ${MONGODB_URI.split('/').pop()}`);
    return true;
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message);
    console.log('\n⚠️  Attempting to start server in fallback mode (data won\'t persist)...\n');
    return false;
  }
};

connectDatabase().then((isConnected) => {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!isConnected) {
      console.log('⚠️  WARNING: Database not connected. Data will not persist.');
      console.log('   Please set MONGODB_URI in .env and restart the server.');
    }
  });
}).catch((err) => {
  console.error('✗ Fatal error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});
