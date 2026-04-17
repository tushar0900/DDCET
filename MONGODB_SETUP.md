# MongoDB Atlas Setup Guide for DDCET Hub

## Step 1: Create a MongoDB Atlas Account
1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Click "Start free" or "Sign Up"
3. Create your account with email/Google/GitHub

## Step 2: Create a Project
1. After signing in, click "Create a Project"
2. Name it "DDCET Hub" (or your preferred name)
3. Click "Create Project"

## Step 3: Create a Cluster
1. Click "Build a Database"
2. Select the **Free tier (M0)** plan
3. Choose your cloud provider (AWS, Google Cloud, or Azure - all free)
4. Select a **Region** close to your users
5. Click "Create Cluster" (this takes 1-3 minutes)

## Step 4: Create Database User
1. Go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. Choose "Password" authentication
4. Enter:
   - **Username**: `ddcet_user` (or your choice)
   - **Password**: Create a strong password (save this!)
5. Set privileges to "Atlas Admin"
6. Click "Add User"

## Step 5: Configure Network Access
1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. To allow connections from anywhere (for Railway/production), click **Allow Access from Anywhere** (0.0.0.0/0)
   - ⚠️ **Or** add your IP address specifically for local development
4. Click "Confirm"

## Step 6: Get Your Connection String
1. Go to **Clusters** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Drivers** (Node.js)
4. Copy the connection string (looks like):
   ```
   mongodb+srv://username:password@cluster0.mongodb.net/myFirstDatabase?retryWrites=true&w=majority
   ```
5. Replace:
   - `username` with your database user
   - `password` with your database password
   - `myFirstDatabase` with `ddcet_hub` (or your database name)

## Step 7: Set Environment Variables

### For Local Development:
1. Create a `.env` file in the `backend/` directory
2. Add:
   ```
   MONGODB_URI=mongodb+srv://your-username:your-password@cluster0.mongodb.net/ddcet_hub
   SECRET_KEY=your-secret-key
   PORT=5001
   NODE_ENV=development
   ```
3. Save the file

### For Railway (Production):
1. Go to your Railway project
2. Click **Settings**
3. Go to **Variables**
4. Add:
   - **MONGODB_URI**: Paste your connection string
   - **SECRET_KEY**: Use a random strong key (e.g., generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - **NODE_ENV**: `production`

## Step 8: Test the Connection
1. In the `backend/` directory, run:
   ```bash
   npm install
   npm start
   ```
2. You should see:
   ```
   ✓ Connected to MongoDB Atlas
   ✓ Server running on http://localhost:5001
   ```

## Step 9: Deploy to Railway
1. Commit and push your changes:
   ```bash
   git add -A
   git commit -m "chore: migrate to MongoDB Atlas"
   git push
   ```
2. Railway will auto-detect the changes and redeploy

## Environment Variable Checklist:
- [ ] MONGODB_URI set correctly
- [ ] Database user created with password
- [ ] Network access configured (IP whitelist or 0.0.0.0/0)
- [ ] SECRET_KEY set (different from development)
- [ ] NODE_ENV set to `production`

## Troubleshooting:

### Connection Refused
- Check IP whitelist (Network Access)
- Verify username and password are correct
- Ensure database user has appropriate permissions

### Authentication Failed
- Double-check the password (case-sensitive)
- Verify the username matches the one created
- Check that special characters in password are URL-encoded in connection string

### Cluster Timeout
- May take 1-3 minutes to fully provision
- Try again in a few moments

## Database Size
- Free tier: 512 MB storage (plenty for student app)
- Upgrade anytime as needed

## Data Management
- Go to **Collections** in your cluster to view your data
- Use **Data Tools** to backup/export data
- Automatic backups available (paid plans)

## Next Steps
After successful connection:
1. Test signup/login at your application
2. Monitor database growth in Atlas dashboard
3. Set up automated backups for production
4. Consider upgrading to paid tier when needed

## Useful Links
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Connection String Syntax](https://docs.mongodb.com/manual/reference/connection-string/)
