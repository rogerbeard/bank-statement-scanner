#!/bin/bash
# Bank Statement Scanner — Run locally (browser mode, no Electron needed)
PORT=47291
echo "Starting Bank Statement Scanner on http://localhost:$PORT ..."
export BSS_UPLOADS_DIR="$(pwd)/uploads"
export BSS_DATA_DIR="$(pwd)/data"
mkdir -p "$BSS_UPLOADS_DIR" "$BSS_DATA_DIR"
node server/index.js &
SERVER_PID=$!
sleep 2
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || echo "Open http://localhost:$PORT in your browser"
wait $SERVER_PID
