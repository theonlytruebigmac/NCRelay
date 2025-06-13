#!/bin/bash

# NCRelay Development Environment Setup Script

echo "==== NCRelay Development Environment Setup ===="
echo

# Check Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v)
  echo "✅ Node.js ${NODE_VERSION} is installed"
  
  # Check if Node.js version is at least v18.0.0
  NODE_VERSION_NUMBER=${NODE_VERSION#v}
  NODE_MAJOR_VERSION=${NODE_VERSION_NUMBER%%.*}
  
  if [ "$NODE_MAJOR_VERSION" -lt "18" ]; then
    echo "❌ Node.js version must be 18.0.0 or higher"
    echo "Please upgrade Node.js and try again"
    exit 1
  fi
else
  echo "❌ Node.js is not installed"
  echo "Please install Node.js 18.0.0 or higher and try again"
  exit 1
fi

# Check npm version
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm -v)
  echo "✅ npm ${NPM_VERSION} is installed"
else
  echo "❌ npm is not installed"
  echo "Please install npm and try again"
  exit 1
fi

# Install dependencies
echo
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies"
  exit 1
fi
echo "✅ Dependencies installed successfully"

# Create .env.local file if it doesn't exist
if [ ! -f .env.local ]; then
  echo
  echo "Creating .env.local file..."
  cat > .env.local << EOF
# Database
NODE_ENV=development

# Initial Admin User (required for first setup)
INITIAL_ADMIN_EMAIL=dev@example.com
INITIAL_ADMIN_PASSWORD=devpassword
INITIAL_ADMIN_NAME=Developer

# Encryption Key (generate a secure 32-character key)
ENCRYPTION_KEY=$(openssl rand -hex 16)

# Optional: Custom port
PORT=9005
EOF
  echo "✅ Created .env.local file with sample configuration"
  echo "⚠️  Please update the values in .env.local as needed"
else
  echo
  echo "✅ .env.local file already exists"
fi

# Run database migrations
echo
echo "Running database migrations..."
npm run migrate
if [ $? -ne 0 ]; then
  echo "❌ Failed to run migrations"
  exit 1
fi
echo "✅ Migrations completed successfully"

echo
echo "==== Setup Complete ===="
echo
echo "To start the development server:"
echo "  npm run dev"
echo
echo "Access the application at: http://localhost:9005"
echo "(or the port specified in your .env.local file)"
echo
echo "Login with:"
echo "  Email: dev@example.com"
echo "  Password: devpassword"
echo "(or the credentials specified in your .env.local file)"
