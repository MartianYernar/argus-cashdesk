"""Adapter to the frozen submission; inference source remains unchanged."""
from pathlib import Path
import sys

DETECTOR = Path(__file__).resolve().parent / "model_package" / "detector"
sys.path.insert(0, str(DETECTOR))
from submission import analyze_video as _analyze
from public_contract import validate_public_job

def analyze_video(path, *, job_id, accepted_at):
    result = _analyze(path, job_id=job_id, accepted_at=accepted_at, budget_sec=280)
    validate_public_job(result, job_id)
    if result["status"] not in ("done", "failed"):
        raise ValueError("Unexpected detector state")
    return result
