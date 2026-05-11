#!/bin/bash
# Bank Statement Scanner — One-time setup script for macOS
set -e

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       BANK STATEMENT SCANNER — SETUP                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo "✅  Node.js $NODE_VER"

# Check poppler
if ! command -v pdftoppm &>/dev/null; then
  echo ""
  echo "⚠️   poppler not found (needed for PDF rendering)."
  echo "    Installing via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install poppler
  else
    echo "❌  Homebrew not found. Install from https://brew.sh then run:"
    echo "    brew install poppler"
    echo "    Then re-run this script."
    exit 1
  fi
fi
echo "✅  poppler (pdftoppm) found"

# Install server dependencies
echo ""
echo "📦  Installing server dependencies..."
npm install

# Install renderer dependencies
echo ""
echo "📦  Installing renderer dependencies..."
cd renderer && npm install && cd ..

# Build renderer
echo ""
echo "🔨  Building renderer..."
cd renderer && npm run build && cd ..

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅  Setup complete!                                ║"
echo "║                                                      ║"
echo "║   To run the app:                                    ║"
echo "║     npm start                                        ║"
echo "║                                                      ║"
echo "║   To build a .dmg installer:                         ║"
echo "║     npm run dist                                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
