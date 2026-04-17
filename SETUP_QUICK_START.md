# MongoDB Atlas Setup - Quick Start

## ✅ Dependencies Installed

### Backend Packages:
- **mongoose** (7.8.9) - MongoDB object modeling
- **express** (5.2.1) - Web framework
- **jsonwebtoken** (9.0.3) - JWT authentication
- **bcryptjs** (3.0.3) - Password hashing
- **cors** (2.8.6) - Cross-origin requests
- **body-parser** (2.2.2) - Request parsing
- **dotenv** (16.6.1) - Environment variables
- **pdf-parse** (2.4.5) - PDF parsing

All packages are ready to use!

## 🔧 Quick Setup Steps

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Start Free"
3. Sign up with email or GitHub

### Step 2: Create Free Cluster
1. After signup, click "Build a Database"
2. Select **M0 Free Tier**
3. Choose your cloud provider (AWS, Google Cloud, or Azure)
4. Select a region
5. Click "Create Cluster"

### Step 3: Create Database User
1. Click "Database Access" in left menu
2. Click "Add New Database User"
3. Create username: `ddcet_user`
4. Create strong password: Save this!
5. Click "Add User"

### Step 4: Setup Network Access
1. Click "Network Access" in left menu
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0) for testing
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Clusters"
2. Click "Connect"
3. Choose "Drivers" → "Node.js"
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `myFirstDatabase` with `ddcet_hub`

### Step 6: Update .env File
The `.env` file is already created at `backend/.env`

Update it with your connection string:
```
MONGODB_URI=mongodb+srv://ddcet_user:YOUR_PASSWORD@cluster0.mongodb.net/ddcet_hub
SECRET_KEY=your-strong-secret-key-12345
PORT=5001
NODE_ENV=development
```

### Step 7: Test Connection
```bash
cd backend
npm start
```

You should see:
```
✓ Connected to MongoDB Atlas
✓ Server running on http://localhost:5001
```

## 🚀 For Railway Deployment

1. Add environment variables to Railway:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `SECRET_KEY`: A new random secure key
   - `NODE_ENV`: `production`

2. Push to GitHub (auto-deploys):
   ```bash
   git add -A
   git commit -m "Update MongoDB Atlas connection"
   git push
   ```

## 📝 Testing the API

### 1. Test Signup
```bash
curl -X POST http://localhost:5001/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "password123",
    "fullName": "John Doe",
    "phone": "9876543210",
    "department": "Computer Science"
  }'
```

### 2. Test Login
```bash
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "password123"
  }'
```

You'll get a JWT token. Use it in other requests:
```bash
curl -X POST http://localhost:5001/api/get-progress \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_JWT_TOKEN"}'
```

## ✨ Database Structure

### Users Collection
```json
{
  "_id": ObjectId,
  "email": "student@example.com",
  "password": "hashed_password",
  "full_name": "John Doe",
  "phone": "9876543210",
  "department": "Computer Science",
  "progress": { /* study progress object */ },
  "current_session_id": "unique_session_id",
  "created_at": ISODate("2024-04-17"),
  "updated_at": ISODate("2024-04-17")
}
```

### LoginLogs Collection
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,
  "email": "student@example.com",
  "ip": "192.168.1.1",
  "device": "Mozilla/5.0...",
  "timestamp": ISODate("2024-04-17")
}
```

## 🛠️ Available API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Login and get JWT token |
| POST | `/api/verify` | Verify token validity |
| POST | `/api/save-progress` | Save user progress |
| POST | `/api/get-progress` | Get user progress |

## 🔐 Security Tips

1. **Never commit .env** - It's in .gitignore
2. **Change SECRET_KEY** in production
3. **Use strong passwords** for MongoDB
4. **Restrict IP access** if not using 0.0.0.0/0
5. **Rotate tokens** regularly

## 📊 Monitoring MongoDB

1. Go to https://cloud.mongodb.com
2. View your cluster
3. Click "Monitoring" to see:
   - Storage usage
   - Operation counts
   - Performance metrics

## 🆘 Troubleshooting

### "Cannot connect to MongoDB"
- Check MONGODB_URI in .env
- Verify IP whitelist (Network Access)
- Ensure cluster is running
- Check username/password

### "Authentication failed"
- Verify password is URL-encoded (if special chars)
- Check username is correct
- Verify user has appropriate permissions

### "Connection timeout"
- Cluster may be initializing (wait 1-3 minutes)
- Check internet connection
- Verify VPN isn't blocking MongoDB

## 📚 Resources

- [MongoDB Docs](https://docs.mongodb.com/)
- [Mongoose Docs](https://mongoosejs.com/)
- [Atlas Console](https://cloud.mongodb.com)
- [Node.js Driver](https://www.mongodb.com/docs/drivers/node/)

---

**You're all set!** All dependencies are installed. Now get your MongoDB Atlas URI and update `.env` file.
