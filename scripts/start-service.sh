#!/bin/bash

# Task Time Tracker - Start Service Script
# This script starts the web application using PM2 for persistent running

echo "🚀 Starting Task Time Tracker Web Service..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the service using PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

echo ""
echo "✅ Task Time Tracker is now running!"
echo ""
echo "📍 Access at: http://localhost:3000"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check service status"
echo "  pm2 logs timetracker-web - View logs"
echo "  pm2 restart timetracker-web - Restart service"
echo "  pm2 stop timetracker-web - Stop service"
echo "  ./stop-service.sh       - Stop using helper script"
echo ""
echo "To make it start automatically on Mac boot:"
echo "  pm2 startup"
echo "  (then run the command it outputs)"
echo ""

# Made with Bob
