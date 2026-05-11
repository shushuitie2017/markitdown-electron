"""
MarkItDown Desktop - Standalone Server
Single-file entry point for PyInstaller packaging.
Merges server.py + main.py into one file.
"""
import argparse
import asyncio
import shutil
import sys
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from markitdown import MarkItDown

# --- Path resolution (PyInstaller compatibility) ---
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent.parent

STATIC_DIR = BASE_DIR / "static"

# --- FastAPI app ---
app = FastAPI(title="MarkItDown Desktop", version="1.0.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

converter = MarkItDown()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".xls",
    ".html", ".htm", ".csv", ".json", ".xml",
    ".jpg", ".jpeg", ".png",
    ".wav", ".mp3", ".m4a",
    ".zip", ".epub", ".ipynb", ".msg",
}


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/formats")
async def formats():
    return {
        "extensions": sorted(SUPPORTED_EXTENSIONS),
        "categories": {
            "documents": [".pdf", ".docx", ".pptx", ".xlsx", ".xls", ".epub"],
            "web": [".html", ".htm"],
            "data": [".csv", ".json", ".xml", ".ipynb"],
            "media": [".jpg", ".jpeg", ".png", ".wav", ".mp3", ".m4a"],
            "archive": [".zip"],
            "email": [".msg"],
        },
    }


@app.post("/api/convert")
async def convert(file: UploadFile = File(...)):
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")

    tmp_dir = tempfile.mkdtemp(prefix="markitdown_")
    tmp_path = Path(tmp_dir) / filename

    try:
        tmp_path.write_bytes(contents)
        result = await asyncio.to_thread(converter.convert, str(tmp_path))

        return {
            "success": True,
            "filename": filename,
            "markdown": result.text_content,
            "title": getattr(result, "title", "") or "",
        }
    except Exception as e:
        error_type = type(e).__name__
        raise HTTPException(status_code=500, detail=f"Conversion failed ({error_type}): {e}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# --- Entry point ---
def main():
    parser = argparse.ArgumentParser(description="MarkItDown Server")
    parser.add_argument("--port", type=int, default=8877, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()

    print(f"MarkItDown Server starting on http://{args.host}:{args.port}")
    print(f"Static dir: {STATIC_DIR}")

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
