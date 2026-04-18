const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');

// Check if .env already exists
if (fs.existsSync(envFile)) {
  console.log('✓ .env file already exists');
  process.exit(0);
}

// Get environment variables
const mongoUri = process.env.MONGODB_URI;
const secretKey = process.env.SECRET_KEY;
const port = process.env.PORT || '5001';

// Warn if critical env vars are missing and we're in production
if (!mongoUri && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: MONGODB_URI not set in environment variables!');
  console.warn('   Set it in Render dashboard or add to .env file');
}

if (!secretKey && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  WARNING: SECRET_KEY not set in environment variables!');
}

// Create .env with actual environment variables or defaults
// NOTE: Do NOT write NODE_ENV into .env to avoid overwriting platform-provided runtime env.
const env = `# MongoDB Connection String
MONGODB_URI=${mongoUri || 'mongodb+srv://Tushar:Tushar123%23@cluster0.xxdrret.mongodb.net/ddcet_hub'}

# JWT Secret Key
SECRET_KEY=${secretKey || 'your-development-secret-key-change-this-12345'}

# Server Port
PORT=${port}

`;

fs.writeFileSync(envFile, env, 'utf8');
console.log('✓ .env file generated from environment variables');

