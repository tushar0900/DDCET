# Render.com Deployment Complete Guide

## ✅ Prerequisites

Before deploying to Render, make sure:

1. ✅ MongoDB Atlas account created
2. ✅ Cluster created at `cluster0.xxdrret.mongodb.net`
3. ✅ Database user created:
   - Username: `Tushar`
   - Password: `Tushar123#`
4. ✅ IP Whitelist: `0.0.0.0/0` added to Network Access
5. ✅ GitHub repository pushed with all code

---

## 🚀 Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub account (recommended for easy deployment)
3. Click "New +" → "Web Service"
4. Select your DDCET GitHub repository

---

## 🔧 Step 2: Configure Render Service

When Render asks for configuration, set these values:

### Build & Start Commands (Render Web Service Settings)

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
cd backend && npm install && npm start
```

### Root Directory

Leave as `.` (root of repository)

---

## 🔐 Step 3: Set Environment Variables

In Render Dashboard → Your Service → Environment Tab:

**Add these 4 environment variables:**

| Key | Value | Notes |
|-----|-------|-------|
| `MONGODB_URI` | `mongodb+srv://Tushar:Tushar123%23@cluster0.xxdrret.mongodb.net/ddcet_hub` | **IMPORTANT**: `#` must be URL-encoded as `%23` |
| `SECRET_KEY` | `your-production-secret-key-change-this-12345` | Change to a strong random string |
| `NODE_ENV` | `production` | Sets production mode |
| `PORT` | `5001` | (Render auto-generates, but set this for clarity) |

### ⚠️ Critical: URL-Encoding Special Characters

Your MongoDB password contains `#`:
- Original: `Tushar123#`
- URL-encoded: `Tushar123%23`

**Other common encodings:**
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`

---

## 📋 Step 4: Verify MongoDB Atlas Configuration

Before deploying, double-check:

### Database Access
1. Go to MongoDB Atlas → Cluster0
2. Click "Database Access" (left sidebar)
3. Find user `Tushar`
4. Verify status: **ACTIVE**
5. Verify password: **Tushar123#**

### Network Access
1. Go to MongoDB Atlas → Cluster0
2. Click "Network Access" (left sidebar)
3. Look for IP address: **0.0.0.0/0**
4. If missing:
   - Click "+ Add IP Address"
   - Enter: `0.0.0.0/0`
   - Click "Add Entry"
   - **Wait 60 seconds** for changes to apply

---

## ✅ Step 5: Deploy

Once environment variables are set:

1. Render auto-deploys when you:
   - Push code to GitHub (if connected)
   - Or manually click "Deploy"

2. Wait 5-10 minutes for deployment

3. Check deployment logs for success message:
   ```
   ✓ Successfully connected to MongoDB Atlas
   ✓ Database: ddcet_hub
   ✓ Server running on http://localhost:5001
   ```

---

## 🧪 Step 6: Test Backend API

After deployment, test the API endpoints:

```bash
# Replace YOUR_RENDER_URL with your actual Render URL
# Example: https://ddcet-hub-backend.onrender.com

# Test server is running
curl https://YOUR_RENDER_URL/api/
```

### API Endpoints Available:
- `POST /api/signup` - Register new user
- `POST /api/login` - Authenticate user
- `POST /api/verify` - Verify JWT token
- `POST /api/save-progress` - Save study progress
- `POST /api/get-progress` - Get study progress

---

## 🔍 Troubleshooting

### ❌ Error: "bad auth: authentication failed"

**Fix:**
1. Check MongoDB user `Tushar` password in Database Access
2. Verify `0.0.0.0/0` is whitelisted in Network Access
3. Wait 60+ seconds after making changes

### ❌ Error: "Port 5001 is not available"

**Fix:**
- Render auto-assigns ports
- Don't hardcode PORT 5001 in start command
- Use: `cd backend && npm install && npm start`
- Server will use Render's PORT environment variable

### ❌ Error: "Cannot find module 'dotenv'"

**Fix:**
1. Ensure dependencies are installed: `npm install` in backend
2. Render runs: `cd backend && npm install && npm start`
3. This should install all dependencies

### ❌ Service keeps crashing

**Debug:**
1. Go to Render Dashboard → Your Service → Logs
2. Look for error messages
3. Common issues:
   - Wrong MONGODB_URI
   - Missing environment variables
   - Incorrect password encoding

---

## 📝 GitHub & Security Notes

### ✅ What's Protected

- `.env` file is in `.gitignore` - **never committed** (secure!)
- Credentials only exist in:
  - Your local `.env` file
  - Render's environment variables
  - MongoDB Atlas (secure connection)

### ⚠️ Never Do This

- Don't commit `.env` file to GitHub
- Don't hardcode credentials in code
- Don't share `MONGODB_URI` in plain text
- Don't use weak SECRET_KEY values

### ✅ Best Practice

1. Use `.env.example` as template (check this in)
2. Keep actual `.env` local only
3. Use Render's environment variables in production
4. Use strong, random SECRET_KEY for production

---

## 🎯 Deployment Checklist

- [ ] GitHub repository is public and up-to-date
- [ ] Render account created and connected to GitHub
- [ ] MongoDB Atlas cluster running and accessible
- [ ] Database user `Tushar` created with password `Tushar123#`
- [ ] IP address `0.0.0.0/0` whitelisted in MongoDB
- [ ] Render environment variables set (all 4)
- [ ] MONGODB_URI has URL-encoded password (`%23` not `#`)
- [ ] Build command: `npm install`
- [ ] Start command: `cd backend && npm install && npm start`
- [ ] Service deployed successfully
- [ ] Logs show "Successfully connected to MongoDB Atlas"
- [ ] API endpoints responding

---

## 🚀 Quick Deploy Summary

**3 Things To Remember:**

1. **Set Render Environment Variables:**
   ```
   MONGODB_URI=mongodb+srv://Tushar:Tushar123%23@cluster0.xxdrret.mongodb.net/ddcet_hub
   SECRET_KEY=your-production-secret-key-change-this-12345
   NODE_ENV=production
   ```

2. **Whitelist MongoDB IP:**
   - Network Access: `0.0.0.0/0`
   - Wait 60 seconds after adding

3. **Test After Deploy:**
   - Check Render logs
   - Should see: "Successfully connected to MongoDB Atlas"
   - API endpoints should respond

---

## 📞 Still Having Issues?

1. Check Render logs for specific error messages
2. Verify MongoDB credentials in Database Access
3. Verify IP whitelist in Network Access
4. See `MONGODB_CONNECTION_FIX.md` for MongoDB issues
5. See `FIX_RENDER_MONGODB.md` for detailed Render troubleshooting
