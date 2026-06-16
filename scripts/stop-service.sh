#!/bin/bash

# Task Time Tracker - Stop Service Script
# This script stops the web application running under PM2

echo "⏹️  Stopping Task Time Tracker Web Service..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Service may not be running."
    exit 1
fi

# Stop the service
pm2 stop timetracker-web

echo ""
echo "✅ Task Time Tracker has been stopped"
echo ""
echo "To start again:"
echo "  ./start-service.sh"
echo "  or: pm2 start timetracker-web"
echo ""

# Made with Bob
