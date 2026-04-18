const path = require('path');
const fs = require('fs');

console.log('🔧 Initializing server...');
console.log(`📁 Working directory: ${__dirname}`);

const envPath = path.join(__dirname, '.env');
console.log(`📁 .env file path: ${envPath}`);
console.log(`📁 .env file exists: ${fs.existsSync(envPath)}`);

// Ensure .env exists at runtime (helps when platform doesn't persist or provide .env)
try {
  const createEnvPath = path.join(__dirname, 'create-env.js');
  if (fs.existsSync(createEnvPath)) {
    require(createEnvPath);
    console.log('✓ create-env executed (ensured .env exists)');
  } else {
    console.log('ℹ️ create-env.js not found; skipping .env generation');
  }
} catch (err) {
  console.warn('⚠️ create-env execution failed:', err.message);
}

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log(`📄 .env file size: ${envContent.length} bytes`);
  console.log(`📄 .env file content (first 200 chars): ${envContent.substring(0, 200)}`);
}

const dotenvResult = require('dotenv').config({ path: envPath });
console.log(`📋 dotenv config result:`, dotenvResult.parsed ? 'SUCCESS' : 'FAILED');
if (dotenvResult.error) {
  console.error(`❌ dotenv error: ${dotenvResult.error.message}`);
}

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5001;
const SECRET_KEY = process.env.SECRET_KEY || 'ddcet_secret_key';

// In production prefer Atlas; avoid falling back to localhost which causes ECONNREFUSED on deploy platforms
const MONGODB_URI = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production'
  ? 'mongodb+srv://Tushar:Tushar123%23@cluster0.xxdrret.mongodb.net/ddcet_hub'
  : 'mongodb://localhost:27017/ddcet_hub');

// Security: in production do not log secrets; mask the connection string when displaying
const maskConnectionString = (uri) => {
  try {
    if (!uri) return '';
    // Replace password between : and @ if present
    return uri.replace(/(:)([^@]+)(@)/, '$1***$3');
  } catch (e) {
    return '***';
  }
};

console.log('📝 Configuration loaded:');
console.log(`   - PORT: ${PORT}`);
console.log(`   - SECRET_KEY: ${process.env.NODE_ENV === 'production' ? '***' : SECRET_KEY.substring(0, 20) + '...'}`);
console.log(`   - MONGODB_URI: ${process.env.NODE_ENV === 'production' ? maskConnectionString(MONGODB_URI) : MONGODB_URI}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   - All env vars: ${Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('PORT') || k.includes('SECRET')).join(', ')}`);

// Fail-fast if running in production without a real remote DB configured
if (process.env.NODE_ENV === 'production') {
  const isLocal = /localhost|127\.0\.0\.1|::1/.test(MONGODB_URI);
  if (isLocal) {
    console.error('❌ FATAL: MONGODB_URI resolves to localhost in production.');
    console.error('   Set a real Atlas MONGODB_URI in your Render service environment variables or render.yaml envVars.');
    console.error('   Continuing to start the server but the application will run in FALLBACK MODE.');
  }
}

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

const connectDatabase = async (retryCount = 0, maxRetries = 3) => {
  try {
    if (retryCount === 0) {
      console.log('🔄 Connecting to MongoDB...');
    }
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      retryWrites: true,
    });
    
    console.log('✓ Successfully connected to MongoDB Atlas');
    const dbName = MONGODB_URI.split('/').pop().split('?')[0];
    console.log(`✓ Database: ${dbName}`);
    return true;
    
  } catch (err) {
    console.error(`\n✗ MongoDB connection failed (Attempt ${retryCount + 1}/${maxRetries + 1}):`);
    console.error(`  Error: ${err.message}\n`);
    
    // Diagnostic information
    if (err.message.includes('bad auth')) {
      console.log('🔍 DIAGNOSIS: Authentication Error');
      console.log('   Possible causes:');
      console.log('   1. ❌ IP address not whitelisted in MongoDB Atlas');
      console.log('   2. ❌ Incorrect username or password');
      console.log('   3. ❌ Database user deleted or permissions removed\n');
      console.log('   🔧 Fix:');
      console.log('   1. Go to MongoDB Atlas → Network Access');
      console.log('   2. Add your IP address or "0.0.0.0/0" to whitelist');
      console.log('   3. Verify username "Tushar" and password in Database Access\n');
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      console.log('🔍 DIAGNOSIS: Connection Error');
      console.log('   Possible causes:');
      console.log('   1. ❌ MongoDB cluster not running');
      console.log('   2. ❌ Invalid cluster URL or region\n');
    } else if (err.message.includes('ETIMEDOUT')) {
      console.log('🔍 DIAGNOSIS: Connection Timeout');
      console.log('   Possible causes:');
      console.log('   1. ❌ IP address blocked by firewall/network');
      console.log('   2. ❌ MongoDB cluster taking too long to respond\n');
    }
    
    if (retryCount < maxRetries) {
      const delay = 3000 * (retryCount + 1); // Exponential backoff: 3s, 6s, 9s
      console.log(`⏳ Retrying in ${delay / 1000} seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDatabase(retryCount + 1, maxRetries);
    }
    
    console.log('❌ Failed to connect after retries.');
    console.log('📖 Check MONGODB_AUTH_TROUBLESHOOTING.md for detailed fixes.\n');
    return false;
  }
};

// Start the HTTP server immediately so platform port checks succeed.
const server = app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Connect to the database in background. Do not block server start.
connectDatabase().then((isConnected) => {
  if (!isConnected) {
    console.log('\n⚠️  WARNING: Running in FALLBACK MODE - Database not connected');
    console.log('   Data will NOT persist between server restarts');
    console.log('   To fix: Whitelist your IP in MongoDB Atlas Network Access\n');
  }
}).catch((err) => {
  console.error('✗ Error connecting to DB (background):', err);
  // Do not exit process - keep server available for read-only or fallback operations
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});
