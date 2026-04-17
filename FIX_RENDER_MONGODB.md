# 🔧 Fix Render Deployment - MongoDB Connection Error

## The Problem

On Render, you're seeing:
```
MongoDB connection failed (Attempt 3/4):
Error: connect ECONNREFUSED ::1:27017, connect ECONNREFUSED 127.0.0.1:27017
```

This means Render is trying to connect to **local MongoDB** instead of **MongoDB Atlas**.

**Why?** The `.env` file is in `.gitignore`, so it wasn't pushed to GitHub/Render. Render doesn't know about your MongoDB Atlas credentials.

---

## ✅ Quick Fix (2 Minutes)

### Step 1: Add Environment Variables in Render Dashboard

1. Go to https://render.com
2. Click on your **ddcet-hub-backend** service
3. Scroll down to **Environment** section
4. Click **Add Environment Variable**

### Step 2: Copy These Exact Values

Add all of these as separate environment variables:

```
Key: MONGODB_URI
Value: mongodb+srv://Tushar:Tushar@cluster0.xxdrret.mongodb.net/ddcet_hub

Key: SECRET_KEY
Value: your-production-secret-key-12345

Key: NODE_ENV
Value: production

Key: PORT
Value: 5001
```

### Step 3: Save and Deploy

- Click **Save** button
- Render automatically redeploys with new environment variables
- **Wait 2-3 minutes** for the deployment to finish

---

## ✅ Also Check MongoDB Atlas

**Critical:** Before the variables take effect, ensure your IP is whitelisted:

1. Go to MongoDB Atlas → **Network Access**
2. Click **Add IP Address**
3. Enter: `0.0.0.0/0` (allows connections from anywhere - required for Render)
4. Click **Confirm**

---

## ✅ Verify the Fix

After deployment, check the Render logs. You should see:

✅ **Success Indicators:**
```
✓ Successfully connected to MongoDB Atlas
✓ Database: ddcet_hub
✓ Server running on http://localhost:5001
```

❌ **Still seeing error?**
- Check that `MONGODB_URI` is exactly correct in Render environment
- Verify IP whitelist in MongoDB Atlas includes `0.0.0.0/0`
- Restart the service: go to Render → Click **Manual Deploy** → **Deploy latest commit**

---

## 📋 Reference: All Required Render Variables

Copy-paste these values exactly:

| Variable Name | Value | Purpose |
|---------------|-------|---------|
| `MONGODB_URI` | `mongodb+srv://Tushar:Tushar@cluster0.xxdrret.mongodb.net/ddcet_hub` | Connect to MongoDB Atlas |
| `SECRET_KEY` | `your-production-secret-key-12345` | JWT token signing |
| `NODE_ENV` | `production` | Production environment |
| `PORT` | `5001` | Server port |

---

## Why .env Doesn't Work with Render

- `.env` is in `.gitignore` (security - never commit passwords!)
- `.gitignore` prevents it from being pushed to GitHub
- Render pulls from GitHub, so it never sees the `.env` file
- **Solution:** Use Render's Environment Variables section instead

---

## Common Mistakes to Avoid

❌ **Don't do this:**
- Don't commit `.env` to GitHub (security risk!)
- Don't leave `MONGODB_URI` blank in Render
- Don't forget to whitelist IP in MongoDB Atlas

✅ **Do this:**
- Use Render's Environment section for secrets
- Copy-paste the exact connection string
- Verify MongoDB whitelist includes `0.0.0.0/0` or Render's IP

---

## After This Fix Works

Your Render deployment will:
- ✅ Connect successfully to MongoDB Atlas
- ✅ Accept user registrations
- ✅ Store login sessions
- ✅ Persist study progress
- ✅ Track login history

**Your DDCET Hub will be fully functional!** 🎉

---

## Troubleshooting Checklist

- [ ] MONGODB_URI added to Render environment variables
- [ ] SECRET_KEY added to Render environment variables
- [ ] NODE_ENV set to `production`
- [ ] PORT set to `5001`
- [ ] IP whitelist updated in MongoDB Atlas (0.0.0.0/0)
- [ ] Render service redeployed after adding variables
- [ ] Logs show "Successfully connected to MongoDB Atlas"
- [ ] Test endpoint: `https://your-render-url.onrender.com/api/login`

---

## Next Steps

1. ✅ Add environment variables to Render
2. ✅ Verify MongoDB whitelist
3. ✅ Check deployment logs
4. ✅ Test the API
5. ✅ Update frontend API URL to your Render domain
