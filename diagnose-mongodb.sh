#!/bin/bash
# MongoDB Connection Diagnostic Script

echo "========================================="
echo "MongoDB Connection Diagnostic"
echo "========================================="
echo ""
echo "📋 Current Configuration:"
echo ""

# Read from backend/.env
BACKEND_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/backend" && pwd )"
ENV_FILE="$BACKEND_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  echo "✓ .env file found at: $ENV_FILE"
  echo ""
  
  # Extract MongoDB URI
  MONGODB_URI=$(grep "^MONGODB_URI=" "$ENV_FILE" | cut -d'=' -f2)
  if [ -n "$MONGODB_URI" ]; then
    echo "✓ MongoDB URI extracted:"
    echo "  $MONGODB_URI"
    echo ""
    
    # Parse the URI
    if [[ $MONGODB_URI == mongodb+srv://* ]]; then
      echo "✓ Using MongoDB Atlas (cloud database)"
      
      # Extract username and password
      USERPASS=$(echo $MONGODB_URI | sed 's/mongodb+srv:\/\///' | cut -d'@' -f1)
      CLUSTER=$(echo $MONGODB_URI | sed 's/mongodb+srv:\/\///' | cut -d'@' -f2 | cut -d'/' -f1)
      
      USERNAME=$(echo $USERPASS | cut -d':' -f1)
      PASSWORD=$(echo $USERPASS | cut -d':' -f2)
      
      echo "  Username: $USERNAME"
      echo "  Password: [${#PASSWORD} characters]"
      echo "  Cluster: $CLUSTER"
      echo ""
      
      echo "🔍 What to check in MongoDB Atlas:"
      echo ""
      echo "1️⃣ Database Access - Verify User:"
      echo "   - Go to: https://cloud.mongodb.com/"
      echo "   - Click: Your Cluster"
      echo "   - Go to: Database Access (left sidebar)"
      echo "   - Look for user: '$USERNAME'"
      echo "   - Verify: Password is exactly '$PASSWORD'"
      echo "   - Verify: User status is ACTIVE"
      echo ""
      
      echo "2️⃣ Network Access - Whitelist IP:"
      echo "   - Go to: https://cloud.mongodb.com/"
      echo "   - Click: Your Cluster"
      echo "   - Go to: Network Access (left sidebar)"
      echo "   - Look for IP: '0.0.0.0/0' (OR your specific IP)"
      echo "   - If NOT found: Click '+ Add IP Address' and add '0.0.0.0/0'"
      echo "   - Wait: 60 seconds after adding IP"
      echo ""
      
    else
      echo "⚠️  Not using MongoDB Atlas (using local MongoDB)"
      echo "   Make sure MongoDB is running on your local machine"
    fi
  else
    echo "❌ MONGODB_URI not found in .env"
  fi
else
  echo "❌ .env file not found at: $ENV_FILE"
  echo "   Create it in the backend directory"
fi

echo ""
echo "========================================="
echo "To fix: Follow the steps above, then"
echo "restart the server: npm start"
echo "========================================="
