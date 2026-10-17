"""
>>> THIS IS THE FILE TO PLUG THE MODEL INTO <<<

`analyze_video(path)` gets a local path to the uploaded .mov and must return
a list of violations (empty list = no violation). Each violation:

    {
        "type": "Ценности без присмотра",          # violation class name
        "timecode_sec": 44.2,                       # when it happens
        "description": "Что видно и почему это может быть нарушением",
        "evidence_frames": [frame_at(path, 44.2)],  # 1-3 frames, use the helper below
        # optional extras the website understands:
        "confidence": 0.91,
        "rule": {"document": "Правила ... (Постановление НБРК № 231)",
                 "clause": "п. X", "url": "https://adilet.zan.kz/rus/docs/V1900019680"},
    }

Everything must run locally: no cloud AI calls (case section 7).
"""
from __future__ import annotations

import base64

import cv2


def frame_at(path: str, t_sec: float, max_width: int = 960) -> dict:
    """Grab one JPEG frame at `t_sec`, return it in the API's evidence_frames format."""
    cap = cv2.VideoCapture(path)
    cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, t_sec) * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise ValueError(f"cannot read frame at {t_sec}s")
    h, w = frame.shape[:2]
    if w > max_width:
        frame = cv2.resize(frame, (max_width, int(h * max_width / w)))
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return {"timestamp_sec": round(t_sec, 2), "image_base64": base64.b64encode(buf).decode()}


def video_duration(path: str) -> float:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    cap.release()
    return n / fps if fps else 0.0


def analyze_video(path: str, progress=lambda p: None) -> list[dict]:
    """TODO(model): replace this stub with real inference.
    Call progress(0..100) from time to time — the website shows it."""
    progress(50)
    # stub: no detections
    progress(100)
    return []
