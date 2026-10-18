"""Process-isolated local inference with a hard accepted-job deadline."""
import argparse
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
from pipeline import AnalysisError


def validate_result(result):
    if not isinstance(result,dict):raise ValueError('Result must be an object')
    analysis=result['analysis'];events=result['violations']
    if not isinstance(events,list):raise ValueError('Events must be a list')
    if analysis['status']!='done':raise ValueError('Inference did not complete')
    runtime=analysis['runtime_sec']
    if not isinstance(runtime,(int,float)) or not math.isfinite(runtime) or not 0<=runtime<300:raise ValueError('Invalid inference runtime')
    if analysis['windows_scanned']!=analysis['windows_total'] or analysis['windows_total']<=0:raise ValueError('Incomplete timeline scan')
    if result['verdict'] not in ('violation','no_violation') or bool(events)!=(result['verdict']=='violation'):
        raise ValueError('Verdict/event mismatch')
    duration=analysis['duration_sec']
    if not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration<=0:raise ValueError('Invalid video duration')
    for event in events:
        stamp=event['timecode_sec']
        if not isinstance(stamp,(int,float)) or not math.isfinite(stamp) or not 0<=stamp<duration:raise ValueError('Invalid event time')
        if not event['type'] or not event['description']:raise ValueError('Missing event text')
        frames=event['evidence_frames']
        if not 1<=len(frames)<=3:raise ValueError('Evidence count must be 1..3')
        for frame in frames:
            data=base64.b64decode(frame['image_base64'],validate=True)
            if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):raise ValueError('Evidence is not JPEG')
            t=frame['timestamp_sec']
            if not isinstance(t,(int,float)) or not math.isfinite(t) or not 0<=t<duration:raise ValueError('Invalid evidence time')
    return result


def run_job(path,*,accepted_at=None,budget_sec=280,model='qwen3.5:4b',context_size=4096,
            focused_revision='v06',audit_path=None,rules_path=None):
    accepted_at=time.perf_counter() if accepted_at is None else accepted_at
    if not math.isfinite(accepted_at) or not math.isfinite(budget_sec) or not 0<budget_sec<=280:
        raise AnalysisError('Invalid accepted-job timing')
    if accepted_at>time.perf_counter()+.01:raise AnalysisError('Acceptance time cannot be in the future')
    deadline=accepted_at+budget_sec;remaining=deadline-time.perf_counter()
    if remaining<3:raise AnalysisError('Job expired in the GPU queue')
    if context_size not in (4096,8192):raise AnalysisError('Unsupported context size')
    args={'budget_sec':max(1,remaining-1),'deadline_monotonic':deadline-1,
          'focused_checks':True,'focused_revision':focused_revision,
          'audit_path':str(audit_path) if audit_path else None,'rules_path':str(rules_path) if rules_path else None}
    env=os.environ.copy();env.update(FORTE_LOCAL_MODEL=model,FORTE_CONTEXT_SIZE=str(context_size))
    cmd=[sys.executable,str(Path(__file__).resolve()),'--child',str(Path(path).resolve()),'--args',json.dumps(args)]
    try:process=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=remaining,env=env)
    except subprocess.TimeoutExpired as error:raise AnalysisError('Hard process deadline reached; job failed, not clean') from error
    if time.perf_counter()>=deadline:raise AnalysisError('Result arrived after accepted-job deadline')
    try:envelope=json.loads(process.stdout.decode('utf-8'))
    except (UnicodeError,ValueError) as error:raise AnalysisError('Worker returned no valid result; inspect local logs') from error
    if process.returncode or not envelope.get('ok'):
        raise AnalysisError(str(envelope.get('error','Worker failed')),envelope.get('partial'))
    try:result=validate_result(envelope['result'])
    except (KeyError,ValueError,TypeError) as error:raise AnalysisError('Invalid worker result: '+str(error)) from error
    result['analysis']['accepted_job_wall_sec']=round(time.perf_counter()-accepted_at,3)
    result['analysis']['hard_deadline_enforced']=True
    return result


def child(path,args):
    import cv2
    cv2.setNumThreads(2)
    from general_pipeline import analyze_video
    try:return {'ok':True,'result':analyze_video(path,**args)},0
    except AnalysisError as error:return {'ok':False,'error':str(error),'partial':error.partial},1
    except Exception as error:return {'ok':False,'error':type(error).__name__+': '+str(error),'partial':None},1


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--child',required=True);parser.add_argument('--args',required=True)
    options=parser.parse_args();envelope,code=child(options.child,json.loads(options.args))
    sys.stdout.buffer.write(json.dumps(envelope,ensure_ascii=False).encode('utf-8'));sys.stdout.buffer.flush()
    raise SystemExit(code)
