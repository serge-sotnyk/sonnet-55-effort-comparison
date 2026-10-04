#!/bin/sh
# Serve the game on http://localhost:8765  (any static file server works)
cd "$(dirname "$0")"
echo "Age of Crowns -> http://localhost:8765"
exec python3 -m http.server 8765
