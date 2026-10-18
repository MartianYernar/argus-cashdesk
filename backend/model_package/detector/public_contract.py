"""Competition public JSON contract, independent of private engine diagnostics."""
import base64
import binascii
import math


def finite_time(value):
    return type(value) in (int,float) and math.isfinite(value) and value>=0


def validate_public_job(payload,expected_job_id=None):
    if not isinstance(payload,dict):raise ValueError('Job response must be an object')
    job_id=payload.get('job_id')
    if not isinstance(job_id,str) or not job_id:raise ValueError('Missing job_id')
    if expected_job_id is not None and job_id!=expected_job_id:raise ValueError('Job ID mismatch')
    status=payload.get('status')
    if status not in ('processing','done','failed'):raise ValueError('Invalid public job status')
    if status!='done':return payload
    verdict=payload.get('verdict');events=payload.get('violations')
    if verdict not in ('violation','no_violation') or not isinstance(events,list):
        raise ValueError('Missing verdict or violations')
    if bool(events)!=(verdict=='violation'):raise ValueError('Verdict/event mismatch')
    for event in events:
        if not isinstance(event,dict):raise ValueError('Invalid event')
        if any(not isinstance(event.get(k),str) or not event[k].strip() for k in ('type','description')):
            raise ValueError('Missing event text')
        if not finite_time(event.get('timecode_sec')):raise ValueError('Invalid event time')
        frames=event.get('evidence_frames')
        if not isinstance(frames,list) or not 1<=len(frames)<=3:raise ValueError('Need 1-3 evidence frames')
        for frame in frames:
            if not isinstance(frame,dict) or not finite_time(frame.get('timestamp_sec')):
                raise ValueError('Invalid evidence timestamp')
            encoded=frame.get('image_base64')
            if not isinstance(encoded,str):raise ValueError('Missing base64 evidence')
            try:data=base64.b64decode(encoded,validate=True)
            except (ValueError,binascii.Error) as error:raise ValueError('Invalid base64 evidence') from error
            if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):
                raise ValueError('Evidence must be JPEG')
    return payload


def public_result(job_id,result):
    """Adapt completed internal inference to the exact required public fields."""
    from job_worker import validate_result
    validate_result(result)
    events=[{k:event[k] for k in ('type','timecode_sec','description','evidence_frames')}
            for event in result['violations']]
    payload={'job_id':job_id,'status':'done','verdict':result['verdict'],'violations':events}
    return validate_public_job(payload,job_id)
