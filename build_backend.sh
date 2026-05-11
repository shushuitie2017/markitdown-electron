#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo " Building MarkItDown Server with PyInstaller"
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/python"

# Find magika package location for model/config data
MAGIKA_DIR=$(python3 -c "import magika, os; print(os.path.dirname(magika.__file__))")
echo "Magika package: $MAGIKA_DIR"

pyinstaller --onedir --name server \
  --add-data "../static:static" \
  --add-data "$MAGIKA_DIR/models:magika/models" \
  --add-data "$MAGIKA_DIR/config:magika/config" \
  --hidden-import uvicorn \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.http.h11_impl \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import uvicorn.lifespan.off \
  --hidden-import multipart \
  --hidden-import markitdown \
  --noconfirm \
  --clean \
  server_standalone.py

if [ $? -eq 0 ]; then
  echo ""
  echo "Build successful! Output: python/dist/server/"
else
  echo ""
  echo "Build FAILED!"
  exit 1
fi
