"""Local ARGUS server: one GPU job, strict accepted-job deadline, no demo fallback."""
from __future__ import annotations
import asyncio
import hmac
import json
import logging
import os
import secrets
import threading
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from analyzer import analyze_video

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT.parent / ".runtime"
RUNTIME.mkdir(exist_ok=True)
KEY_FILE = RUNTIME / "api-key"
if not KEY_FILE.exists():
    KEY_FILE.write_text(secrets.token_urlsafe(32), encoding="utf-8")
API_KEY = os.environ.get("ARGUS_API_KEY") or KEY_FILE.read_text(encoding="utf-8").strip()
UPLOADS = ROOT / "uploads"
UPLOADS.mkdir(exist_ok=True)
DIST = ROOT.parent / "dist"
MODEL = "qwen3.5:4b"
BUDGET = 280
JOBS = {}
LOCK = threading.Lock()
SLOT = threading.BoundedSemaphore(1)
POOL = ThreadPoolExecutor(max_workers=1)
logger = logging.getLogger("argus")
app = FastAPI(title="ARGUS local inference", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["X-API-Key", "Content-Type"])

def require_key(x_api_key: Optional[str] = Header(default=None)):
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(401, "invalid or missing X-API-Key")

def model_health():
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open("http://127.0.0.1:11434/api/tags", timeout=3) as r:
            names = [m.get("name") for m in json.load(r).get("models", [])]
        ready = MODEL in names
        return {"ready": ready, "model": MODEL, "reason": None if ready else "model_not_installed"}
    except Exception:
        return {"ready": False, "model": MODEL, "reason": "ollama_unavailable"}

@app.get("/api/local-config.js", include_in_schema=False)
def local_config(request: Request):
    local_host = request.url.hostname in ("127.0.0.1", "localhost", "::1", "testserver")
    local_client = request.client.host in ("127.0.0.1", "::1", "testclient")
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Same-origin browser required")
    config = {"url": ""}
    if local_host and local_client and not request.headers.get("cf-connecting-ip"):
        config["key"] = API_KEY
    return Response("window.ARGUS_LOCAL=" + json.dumps(config) + ";", media_type="application/javascript", headers={"Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin"})

@app.get("/api/v1/health", dependencies=[Depends(require_key)])
def health():
    return _health()

def _health():
    with LOCK:
        busy = any(j["status"] == "processing" for j in JOBS.values())
    return {**model_health(), "busy": busy}

def _run(job_id, path, accepted_at):
    try:
        result = analyze_video(str(path), job_id=job_id, accepted_at=accepted_at)
        if time.perf_counter() >= accepted_at + BUDGET:
            result = {"job_id": job_id, "status": "failed"}
        with LOCK:
            if JOBS[job_id]["status"] == "processing":
                JOBS[job_id] = result
    except Exception:
        logger.exception("Analysis failed: %s", job_id)
        with LOCK:
            JOBS[job_id] = {"job_id": job_id, "status": "failed"}
    finally:
        path.unlink(missing_ok=True)
        SLOT.release()

@app.post("/api/v1/analyze", dependencies=[Depends(require_key)])
async def analyze(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".mov", ".mp4", ".m4v", ".webm", ".avi", ".mkv"):
        raise HTTPException(415, "Supported video file required")
    if not SLOT.acquire(blocking=False):
        raise HTTPException(429, "РџСЂРѕРІРµСЂРєР° СѓР¶Рµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ. РџРѕРІС‚РѕСЂРёС‚Рµ РїРѕСЃР»Рµ РµС‘ Р·Р°РІРµСЂС€РµРЅРёСЏ.", headers={"Retry-After": "10"})
    path = None
    try:
        state = await asyncio.to_thread(model_health)
        if not state["ready"]:
            raise HTTPException(503, "Р›РѕРєР°Р»СЊРЅР°СЏ РјРѕРґРµР»СЊ РЅРµ РіРѕС‚РѕРІР°: " + state["reason"])
        job_id = uuid.uuid4().hex
        path = UPLOADS / (job_id + suffix)
        size = 0
        with path.open("wb") as target:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > 2 * 1024 ** 3:
                    raise HTTPException(413, "Video exceeds 2 GB")
                target.write(chunk)
        if size == 0:
            raise HTTPException(400, "Empty video")
        accepted_at = time.perf_counter()
        with LOCK:
            # Retain a bounded amount of evidence in memory.
            while len(JOBS) >= 50:
                JOBS.pop(next(iter(JOBS)))
            JOBS[job_id] = {"job_id": job_id, "status": "processing", "_accepted_at": accepted_at}
        POOL.submit(_run, job_id, path, accepted_at)
        return {"job_id": job_id}
    except BaseException:
        if path:
            path.unlink(missing_ok=True)
        SLOT.release()
        raise
    finally:
        await file.close()

@app.get("/api/v1/jobs/{job_id}", dependencies=[Depends(require_key)])
def job(job_id: str):
    with LOCK:
        j = JOBS.get(job_id)
        if j is None:
            raise HTTPException(404, "job not found")
        if j["status"] == "processing" and time.perf_counter() - j["_accepted_at"] >= BUDGET:
            j = JOBS[job_id] = {"job_id": job_id, "status": "failed"}
        return {k: v for k, v in j.items() if not k.startswith("_")}

if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
