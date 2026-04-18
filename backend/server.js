const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('🔧 Initializing server...');
console.log(`📁 Working directory: ${__dirname}`);

const envPath = path.join(__dirname, '.env');
console.log(`📁 .env file path: ${envPath}`);
console.log(`📁 .env file exists: ${fs.existsSync(envPath)}`);

// Load .env file if it exists (postinstall hook creates it at build time)
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

// ==================== HEALTH CHECK ====================
// Render uses this to confirm the service is running; does not depend on DB
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'api_ok', timestamp: new Date().toISOString() });
});

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
  email_verified: {
    type: Boolean,
    default: false,
  },
  email_verification_token: {
    type: String,
    default: null,
  },
  email_verification_expires: {
    type: Date,
    default: null,
  },
  password_reset_token: {
    type: String,
    default: null,
  },
  password_reset_expires: {
    type: Date,
    default: null,
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

// ==================== EMAIL & TOKEN HELPERS ====================

// Generate secure token for password reset and email verification
const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate email format (basic + optional: Google domain only)
const isValidGoogleEmail = (email) => {
  // Accept any email with proper format
  // Optional: restrict to Gmail only by checking: email.endsWith('@gmail.com')
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Send email (console logging for now; replace with Nodemailer for production)
const sendEmail = async (to, subject, htmlBody) => {
  try {
    // For development: just log
    console.log(`\n📧 EMAIL SENT:
To: ${to}
Subject: ${subject}
Body: ${htmlBody}\n`);

    // TODO: In production, integrate with Nodemailer or SendGrid
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.GMAIL_USER,
    //     pass: process.env.GMAIL_PASSWORD,
    //   },
    // });
    // await transporter.sendMail({ from: 'noreply@ddcet.com', to, subject, html: htmlBody });

    return true;
  } catch (error) {
    console.error('❌ Email send error:', error);
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

    // Validate email format (Google approved format or custom validation)
    if (!isValidGoogleEmail(email)) {
      return res.status(400).json({ message: 'Please use a valid email address.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered. Please login or use forgot password.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = generateSecureToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
      full_name: fullName,
      phone,
      department,
      email_verified: false,
      email_verification_token: verificationToken,
      email_verification_expires: verificationExpires,
    });

    await newUser.save();

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${email}`;
    const emailSent = await sendEmail(
      email,
      '🔐 Verify Your DDCET Email',
      `<h3>Welcome to DDCET Study Hub!</h3>
       <p>Click the link below to verify your email:</p>
       <a href="${verificationLink}" style="padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">
         Verify Email
       </a>
       <p>Or use this code: <strong>${verificationToken}</strong></p>
       <p>This link expires in 24 hours.</p>`
    );

    return res.status(201).json({
      message: 'User registered successfully! Please check your email to verify your account.',
      email_sent: emailSent,
    });
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

// Forgot Password Route
app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists for security reasons
      return res.status(200).json({ message: 'If an account with that email exists, a reset link will be sent.' });
    }

    // Generate reset token
    const resetToken = generateSecureToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    user.password_reset_token = resetToken;
    user.password_reset_expires = resetExpires;
    user.updated_at = new Date();
    await user.save();

    // Send reset email (for now just log it)
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost'}/reset-password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;
    const htmlBody = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `;

    await sendEmail(email, 'Password Reset Request - DDCET Hub', htmlBody);

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process password reset request.' });
  }
});

// Reset Password Route
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !email || !password) {
      return res.status(400).json({ message: 'Token, email, and new password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password should be at least 6 characters long.' });
    }

    // Find user and verify token
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || user.password_reset_token !== token) {
      return res.status(401).json({ message: 'Invalid or expired reset token.' });
    }

    // Check if token has expired
    if (new Date() > user.password_reset_expires) {
      user.password_reset_token = null;
      user.password_reset_expires = null;
      await user.save();
      return res.status(401).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.current_session_id = ''; // Clear existing sessions for security
    user.updated_at = new Date();
    await user.save();

    console.log(`✓ Password reset successful for ${email}`);
    res.status(200).json({ message: 'Password reset successfully. Please sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password.' });
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

// ==================== EMAIL VERIFICATION ====================

// Verify Email Route
app.post('/api/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;
    if (!token || !email) {
      return res.status(400).json({ message: 'Token and email are required.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ message: 'Email already verified.' });
    }

    if (user.email_verification_token !== token) {
      return res.status(400).json({ message: 'Invalid verification token.' });
    }

    if (new Date() > user.email_verification_expires) {
      return res.status(400).json({ message: 'Verification token has expired. Please request a new one.' });
    }

    // Mark email as verified
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully! You can now login.' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ message: 'Error verifying email.' });
  }
});

// Resend Verification Email Route
app.post('/api/resend-verification', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ message: 'Email is already verified.' });
    }

    // Generate new verification token
    const verificationToken = generateSecureToken();
    user.email_verification_token = verificationToken;
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send verification email
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}&email=${email}`;
    await sendEmail(
      email,
      '🔐 Verify Your DDCET Email (Resend)',
      `<h3>Email Verification</h3>
       <p>Click the link below to verify your email:</p>
       <a href="${verificationLink}" style="padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">
         Verify Email
       </a>
       <p>This link expires in 24 hours.</p>`
    );

    return res.status(200).json({ message: 'Verification email resent successfully!' });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ message: 'Error resending verification email.' });
  }
});

// ==================== PASSWORD MANAGEMENT ====================

// Forgot Password Route
app.post('/api/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists or not (security)
      return res.status(200).json({ message: 'If email exists, password reset link has been sent.' });
    }

    // Generate password reset token
    const resetToken = generateSecureToken();
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${email}`;
    await sendEmail(
      email,
      '🔐 Reset Your DDCET Password',
      `<h3>Password Reset Request</h3>
       <p>Click the link below to reset your password:</p>
       <a href="${resetLink}" style="padding:10px 20px; background:#28a745; color:white; text-decoration:none; border-radius:5px;">
         Reset Password
       </a>
       <p>This link expires in 1 hour.</p>
       <p><strong>If you didn't request this, ignore this email.</strong></p>`
    );

    return res.status(200).json({ message: 'Password reset link has been sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Error processing forgot password request.' });
  }
});

// Reset Password Route (using token from email)
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
      return res.status(400).json({ message: 'Token, email, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.password_reset_token !== token) {
      return res.status(400).json({ message: 'Invalid reset token.' });
    }

    if (new Date() > user.password_reset_expires) {
      return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.current_session_id = ''; // Invalidate current sessions
    await user.save();

    // Send confirmation email
    await sendEmail(
      email,
      '✅ Your DDCET Password Has Been Changed',
      `<h3>Password Changed Successfully</h3>
       <p>Your password was changed at ${new Date().toLocaleString()}</p>
       <p>If you didn't make this change, please contact support immediately.</p>`
    );

    return res.status(200).json({ message: 'Password has been reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Error resetting password.' });
  }
});

// Update Password Route (authenticated - for logged-in users)
app.post('/api/update-password', async (req, res) => {
  try {
    const { token, currentPassword, newPassword } = req.body;
    if (!token || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Token, current password, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    // Verify JWT token
    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
      if (err) return res.status(401).json({ message: 'Invalid or expired token.' });

      const user = await User.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect.' });
      }

      // Prevent using same password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ message: 'New password must be different from current password.' });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.updated_at = new Date();
      await user.save();

      // Send confirmation email
      await sendEmail(
        user.email,
        '✅ Your DDCET Password Has Been Updated',
        `<h3>Password Updated Successfully</h3>
         <p>Your password was changed at ${new Date().toLocaleString()}</p>
         <p>If you didn't make this change, please reset your password immediately.</p>`
      );

      return res.status(200).json({ message: 'Password updated successfully!' });
    });
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({ message: 'Error updating password.' });
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
