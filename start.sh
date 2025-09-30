#!/bin/bash

echo "🐜 Starting Ant Colony Simulation..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting development server..."
echo "   The simulation will open in your default browser."
echo "   If it doesn't open automatically, go to: http://localhost:8080"
echo ""
echo "🎮 Controls:"
echo "   - Left click: Add food source"
echo "   - Right click: Add pheromone"
echo "   - Space: Pause/Resume"
echo "   - R: Reset simulation"
echo "   - F: Add food at cursor"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm run dev
