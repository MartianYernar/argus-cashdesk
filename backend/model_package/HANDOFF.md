# Final submission — frozen recovery detector

Use this package, not forte_fast. Detection code is byte-for-byte identical to
the recovery run `20261018_100601`. Only `submission.py` was changed for the
public response format and to pin the settings actually used by that run.

No detection experiments were performed in this finalization. The supplied
deadline field was blank; the recorded noon deadline implies a 10:30 experiment
cutoff, which had passed. The frozen backup was created before editing.

## Call from Person C's API worker

Install `requirements-inference.txt` in a Python environment. Have local Ollama
running with `qwen3.5:4b` already installed. Put `detector/` on the import path
or use it as the worker's working directory. Do not import modules from other
detector versions into the same process.

```python
import time
from submission import analyze_video

# At upload acceptance, before waiting for the GPU worker:
accepted_at = time.perf_counter()
# Person C creates/stores job_id and immediately returns {"job_id": job_id}.
# In the single background GPU worker, with that same acceptance timestamp:
result = analyze_video(
    uploaded_mov_path,
    job_id=job_id,
    accepted_at=accepted_at,
    budget_sec=280,
    audit_path=local_private_audit_path,  # optional; keep local
)
# Store result for GET /api/v1/jobs/{job_id}.
```

The call blocks until done/failed. Do not block POST /api/v1/analyze while
inference runs. Use multipart field `file` for the MOV upload. Protect both
endpoints using X-API-Key. Use one GPU worker and a bounded queue: queue waiting
consumes the same 280-second deadline. Do not reset accepted_at on dequeue.
The service must return failures promptly, including jobs that expire in queue.
Allow the remaining 20 seconds for response delivery within the 300-second
requirement. Do not queue more work than can fit this deadline.

## Output contract

The supplied task's format placeholder was blank. This package uses the
previously supplied hackathon contract, already implemented in public_contract.py:

```json
{
  "job_id": "the-API-job-id",
  "status": "done",
  "verdict": "violation",
  "violations": [
    {
      "type": "event type",
      "timecode_sec": 12.3,
      "description": "visible event description",
      "evidence_frames": [
        {"timestamp_sec": 12.3, "image_base64": "raw base64 JPEG, no data-URL prefix"}
      ]
    }
  ]
}
```

Each event has 1–3 evidence frames. A completed clean result has
`verdict="no_violation"` and `violations=[]`. Any inference error, timeout,
malformed result or expired deadline returns only:

```json
{"job_id": "the-API-job-id", "status": "failed"}
```

Errors are logged locally. Failed jobs never carry a clean verdict or partial
event evidence. While a job runs, the API serves its own `processing` state.
This adapter already returns the public envelope; do not call public_result
on it again. API callers should supply job_id; standalone calls may omit it
and receive a generated ID. Existing callers expecting private `analysis`
fields must switch to this documented public response.

## Fixed settings

- Model: local `qwen3.5:4b`; thinking disabled by the existing Ollama adapter.
- Context: 4096. Focused revision: v06. Internal version: general-0.7-recovery.
- Hard accepted-job budget: 280 seconds, including queue wait and subprocess.
- Existing scan scheduling, evidence sampling, individual checks and prompts
  are unchanged. No fast-version batching, scan limit or cache changes.
- `rules.json` is unchanged: 14 detect categories, 7 review-only categories;
  citations remain unchanged/null. X-2 ID verification remains review-only.
- No Qwen fine-tuning; separately trained classifiers are not deployed.

## Measured development results

| Clip | Result | Accepted-job seconds |
|---|---|---:|
| X-1 | Missed | 156.631 |
| X-2 | Missed | 56.322 |
| X-3 | Correct | 75.673 |
| X-5 | Correct | 234.293 |
| X-14 | Correct | 261.305 |
| X-21 | Correct | 116.359 |
| X-32 | Correct | 103.766 |
| X-46 | Correct | 154.013 |

Tested: 8. Correct: 6. Missed: 2. False alarms: 0. Processing failures: 0.
Four clean clips were cleared; two of four positive clips were detected.
These are the saved recovery results, not new runs of the final adapter.
All eight saved source fingerprints match the frozen detector.

Typical observed accepted-job time: median about 135 seconds, range 56–261
seconds. X-14 is the longest of the 42 supplied videos (142.533 seconds of
footage); its measured accepted-job time was 261.305 seconds on this laptop.
This establishes that this clip completed under five minutes in that run,
not a guarantee for arbitrary videos, queues or other hardware.

## Validation and limits

Software checks cover the public adapter, failure handling, deadlines, decoding,
gates and existing recovery behavior. The saved eight results are replayed
through the public adapter without rerunning inference to check serialization.
Software checks and replay are not new recognition measurements.

Known misses: X-1 cash diversion and X-2 ID verification. Brief actions and
small/occluded objects may be missed. No new camera angle was tested. No overall
accuracy is claimed. Legal mappings were not changed or newly verified.
All footage, frames, descriptions and inference remain local; do not upload
them to a cloud AI. The archive includes code and numerical scores, no footage,
evidence images, audit answers or model weights.

## Public endpoint test

No Person C URL/key were provided, so no live API smoke test was run. Once
Person C supplies the team's own URL and sets FORTE_API_KEY locally, run
api_smoke.py according to its --help. It uploads one MOV to that service and
checks both authentication routes, job states, public output and the deadline.
The submitted endpoint must run the detector locally; this package does not
deploy or host the service.
