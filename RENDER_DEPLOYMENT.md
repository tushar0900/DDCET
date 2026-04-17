# 🚀 Render.com Deployment Guide

## Quick Setup Steps

### 1. Connect Your GitHub Repository
1. Go to https://render.com
2. Click **New +**
3. Select **Web Service**
4. Click **Connect Repository**
5. Search for `DDCET` and connect

### 2. Configure the Web Service

Fill in these fields:

| Field | Value |
|-------|-------|
| **Name** | `ddcet-hub-backend` (or any name) |
| **Environment** | `Node` |
| **Region** | Choose closest to you |
| **Root Directory** | `.` (current folder) |
| **Build Command** | `npm install` |
| **Start Command** | `cd backend && npm install && npm start` |

### 3. Add Environment Variables

After creating the service, go to **Environment** section and add:

```
MONGODB_URI=mongodb+srv://Tushar:Tushar@cluster0.xxdrret.mongodb.net/ddcet_hub
SECRET_KEY=your-secure-random-key-here
NODE_ENV=production
```

### 4. Deploy

Click **Create Web Service** - Render will automatically deploy!

You'll get a URL like: `https://ddcet-hub-backend.onrender.com`

---

## ⚠️ Before Deploying

### ✅ Step 1: Whitelist Render's IP in MongoDB Atlas

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Enter: `0.0.0.0/0` (allows all IPs - easiest for quick setup)
4. Click **Confirm**

**OR** get Render's IP from deployment logs and whitelist only that.

### ✅ Step 2: Verify Database Credentials

1. Go to MongoDB Atlas → **Database Access**
2. Find user **"Tushar"**
3. Verify:
   - ✅ Status: Active
   - ✅ Password: Correct (must match in MONGODB_URI)
   - ✅ Built-in Role: Atlas Admin

---

## Your Deployment Details

### GitHub Repository
```
https://github.com/tushar0900/DDCET
```

### MongoDB Connection
```
mongodb+srv://Tushar:Tushar@cluster0.xxdrret.mongodb.net/ddcet_hub
```

### Backend Server (Will be deployed to)
```
https://ddcet-hub-backend.onrender.com
```

### Frontend (Static HTML - Deploy separately)
```
Use GitHub Pages or Netlify for static HTML files
```

---

## After Deployment

### ✅ Test the Backend

```bash
curl https://ddcet-hub-backend.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Should see: `{"message":"Invalid credentials"}` (this means server is working!)

### ✅ Update Frontend API URL

In `auth.js`, change:
```javascript
// FROM:
const API_BASE_URL = 'http://localhost:5001/api';

// TO:
const API_BASE_URL = 'https://ddcet-hub-backend.onrender.com/api';
```

Then deploy frontend separately.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | Check MongoDB connection - likely IP whitelist issue |
| Build fails | Make sure both package.json files exist (root and backend/) |
| "bad auth" error | Whitelist Render's IP in MongoDB Atlas Network Access |
| Cold start slow | Render's free tier has 30-second timeout - normal |

---

## Important Notes

- ✅ Free tier includes:
  - Web service: 0.5GB RAM
  - 750 hours/month
  - Auto-pause after 15m inactivity
  
- ⚠️ Data persistence:
  - ✅ MongoDB Atlas stores all data (separate service)
  - ✅ Data persists even when Render service pauses
  - ❌ Local files don't persist (use MongoDB, not SQLite)

---

## Next Steps

1. ✅ Commit and push to GitHub
2. ✅ Go to https://render.com
3. ✅ Create new Web Service
4. ✅ Add environment variables
5. ✅ Deploy!

Your DDCET Hub will be **live and accessible from anywhere!** 🚀

Need help? Check the troubleshooting guide or review the render.yaml file in your repo.
