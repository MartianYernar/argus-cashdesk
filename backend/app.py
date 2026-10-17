"""ARGUS API — implements the jury contract from the case (section 10).

    POST /api/v1/analyze        multipart field `file` (.mov)  -> {"job_id": ...}
    GET  /api/v1/jobs/{job_id}  -> {"job_id", "status": processing|done|failed, "verdict", "violations"}

Run:  ARGUS_API_KEY=secret uvicorn app:app --host 0.0.0.0 --port 8000
If ../dist exists (npm run build), the website is served at / too.
"""
from __future__ import annotations

import os
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from analyzer import analyze_video

API_KEY = os.environ.get("ARGUS_API_KEY", "change-me")
UPLOADS = Path(__file__).parent / "uploads"
UPLOADS.mkdir(exist_ok=True)
DIST = Path(__file__).parent.parent / "dist"

app = FastAPI(title="ARGUS API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

JOBS: dict[str, dict] = {}
LOCK = threading.Lock()
POOL = ThreadPoolExecutor(max_workers=int(os.environ.get("ARGUS_WORKERS", "1")))


def require_key(x_api_key: Optional[str] = Header(default=None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


def _run(job_id: str, path: Path):
    def progress(p: float):
        with LOCK:
            JOBS[job_id]["progress"] = float(p)

    try:
        violations = analyze_video(str(path), progress)
        with LOCK:
            JOBS[job_id].update(
                status="done",
                verdict="violation" if violations else "no_violation",
                violations=violations,
                progress=100.0,
            )
    except Exception as e:  # noqa: BLE001
        with LOCK:
            JOBS[job_id].update(status="failed", error=str(e))
    finally:
        path.unlink(missing_ok=True)


@app.post("/api/v1/analyze", dependencies=[Depends(require_key)])
async def analyze(file: UploadFile = File(...)):
    job_id = uuid.uuid4().hex[:8]
    path = UPLOADS / f"{job_id}{Path(file.filename or 'v.mov').suffix or '.mov'}"
    with path.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    with LOCK:
        JOBS[job_id] = {"job_id": job_id, "status": "processing", "progress": 0.0}
    POOL.submit(_run, job_id, path)
    return {"job_id": job_id}


@app.get("/api/v1/jobs/{job_id}", dependencies=[Depends(require_key)])
async def job(job_id: str):
    with LOCK:
        j = JOBS.get(job_id)
        if not j:
            raise HTTPException(status_code=404, detail="job not found")
        return dict(j)


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
