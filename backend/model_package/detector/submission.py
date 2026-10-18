"""Person C's inference import. Local model and rule configuration are required.

from submission import analyze_video, AnalysisError

This adapter returns completed/failed public job envelopes. The API owns
X-API-Key auth, upload handling and a bounded GPU queue. The engine's worker
enforces a hard process timeout. Supply accepted_at to include queue waiting.
"""
import time
import math
import uuid
import logging
from job_worker import run_job
from pipeline import AnalysisError
from public_contract import public_result


def analyze_video(path,*,job_id=None,deadline_monotonic=None,accepted_at=None,budget_sec=280,
                  focused_revision='v06',context_size=4096,rules_path=None,audit_path=None):
    """Return official completed/failed job JSON using the frozen recovery logic.

    Capture accepted_at=time.perf_counter() at upload acceptance, before queue
    waiting. Call in a background GPU worker. Only measured settings are accepted.
    Errors and partial results return failed, without a verdict or evidence.
    """
    public_id=job_id if isinstance(job_id,str) and job_id.strip() else str(uuid.uuid4())
    try:
        if job_id is not None and (not isinstance(job_id,str) or not job_id.strip()):
            raise ValueError('job_id must be a nonempty string')
        if focused_revision!='v06' or context_size!=4096:
            raise ValueError('Final detector requires v06 and context size 4096')
        if type(budget_sec) not in (int,float) or not math.isfinite(budget_sec) or not 0<budget_sec<=280:
            raise ValueError('Budget must be finite and within 0..280 seconds')
        if deadline_monotonic is not None:
            if not math.isfinite(deadline_monotonic):raise ValueError('Invalid deadline')
            if accepted_at is None:accepted_at=deadline_monotonic-budget_sec
            budget_sec=min(budget_sec,deadline_monotonic-accepted_at)
        if accepted_at is None:accepted_at=time.perf_counter()
        internal=run_job(path,accepted_at=accepted_at,budget_sec=budget_sec,model='qwen3.5:4b',
                        context_size=4096,focused_revision='v06',rules_path=rules_path,audit_path=audit_path)
        payload=public_result(public_id,internal)
        if time.perf_counter()>=accepted_at+budget_sec:
            raise AnalysisError('Public result completed after the accepted-job deadline')
        return payload
    except Exception:
        logging.getLogger(__name__).exception('Detector job failed: %s',public_id)
        return {'job_id':public_id,'status':'failed'}

__all__=['analyze_video','AnalysisError']
