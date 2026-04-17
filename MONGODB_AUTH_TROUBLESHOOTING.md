# MongoDB Atlas Authentication Troubleshooting

## Current Issue
**Error:** `bad auth : authentication failed`

This error means the MongoDB Atlas server rejected the username or password you provided.

## Quick Fixes to Try

### 1. ✅ Check IP Whitelist (Most Common Cause)
1. Go to https://cloud.mongodb.com
2. Click your project
3. Go to **Network Access** (left sidebar)
4. Look for whitelist entries
5. **IMPORTANT:** If your IP is not listed, add it:
   - Click "Add IP Address"
   - Add your current IP OR click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

### 2. Verify Database User Credentials
1. Go to **Database Access** in MongoDB Atlas
2. Find user "Tushar"
3. Check the **password** - it must match exactly in the connection string
4. Make sure **Built-In Roles** includes "Atlas Admin" (for development)

### 3. Check Connection String Format
```
mongodb+srv://username:password@cluster.mongodb.net/database_name
```

Your current string:
```
mongodb+srv://Tushar:Tushar@cluster0.xxdrret.mongodb.net/ddcet_hub
```

### 4. Special Characters in Password
If password contains special characters, they must be URL-encoded:
- `@` → `%40`
- `#` → `%23`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `&` → `%26`

Example: If password is `Pass@123`, use: `Pass%40123`

### 5. Verify Cluster is Running
1. Go to **Clusters**
2. Make sure your cluster shows status "Deployed" (not paused)
3. If paused, resume it

## How to Get Fresh Connection String from Atlas

1. Go to https://cloud.mongodb.com
2. Click **Clusters**
3. Click **Connect** on your cluster
4. Choose **Drivers**
5. Select **Node.js**
6. Copy the connection string
7. Replace `<password>` with your actual password
8. Update `.env` file

## Testing Connection

After fixing the issue, restart server:
```bash
cd backend
node server.js
```

You should see:
```
✓ Connected to MongoDB
✓ Database: ddcet_hub
✓ Server running on http://localhost:5001
```

## API Testing (Even Without MongoDB)

Your server is currently running in **fallback mode** - you can test the API:

### Test Signup:
```bash
curl -X POST http://localhost:5001/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "phone": "9876543210",
    "department": "Computer Science"
  }'
```

### Test Login:
```bash
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

In fallback mode, the API responds but data doesn't persist.

## Still Having Issues?

1. **Double-check username** - is it "Tushar" or something else?
2. **Copy password carefully** - spaces at start/end will cause failure
3. **Check cluster region** - verify you're in correct region
4. **Try creating a new database user** with a simpler password (like `db123456`)
5. **Check MongoDB Atlas status** - go to https://status.mongodb.com

## Current Setup Info
- Server Port: 5001
- Database: ddcet_hub
- Cluster: cluster0
- Region: Check in MongoDB Atlas settings

---

Once you fix the authentication, data will persist to MongoDB Atlas!
