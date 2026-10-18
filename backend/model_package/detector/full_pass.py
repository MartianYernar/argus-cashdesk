"""One resumable local pass: training status, debug comparison, broad evaluation.

No footage or generated descriptions leave the machine. Model weights are not
automatically promoted because they fit training data. All scores are development
scores; a genuinely new angle and the public API remain separate checks.
"""
import argparse
import csv
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import time

import cv2
from evaluate import score
from event_score import score_events,matches
from job_worker import run_job,validate_result
from pipeline import ROOT,AnalysisError,api,render_report

DEBUG=['X-21','X-46','X-3','X-32']
BASELINE=ROOT/'focused_benchmarks'/'20261018_084059'
SOURCES=['pipeline.py','general_pipeline.py','focused_checks.py','focused_checks_v05.py','event_gates.py','job_worker.py','full_pass.py','evaluate.py','event_score.py','rules.json','labels.csv']


def fingerprint():
    digest=hashlib.sha256()
    for name in SOURCES:digest.update(name.encode());digest.update((ROOT/name).read_bytes())
    return digest.hexdigest()


def save(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8');temp.replace(path)


def training_status(videos):
    reports=[]
    for kind in ('pyramid','pyramid_delta'):
        pattern='supervised_'+kind+'_20*'
        candidates=sorted((ROOT/'local_training').glob(pattern))
        complete=[p for p in candidates if (p/'window_model.npz').is_file() and (p/'cross_validation.json').is_file()]
        if not complete:
            from supervised import train_and_evaluate
            output,report=train_and_evaluate(videos,kind)
        else:
            output=complete[-1];report=json.loads((output/'cross_validation.json').read_text(encoding='utf-8'))
        reports.append({'kind':kind,'report':str(output/'cross_validation.json'),'weights':str(output/'window_model.npz'),
                        'summary':report['summary'],'runtime_sec':report['runtime_sec'],
                        'deployment':'not_enabled','reason':'Binary appearance classifier is not verified event evidence; no automatic deployment.'})
    return reports


def ordered_ids(videos):
    rows=list(csv.DictReader((ROOT/'labels.csv').read_text(encoding='utf-8-sig').splitlines()))
    labels={r['video']:r['verdict']=='violation' for r in rows}
    available={p.stem.upper().replace('\u0425','X'):p for p in Path(videos).glob('*.mov')}
    if set(labels)-set(available):raise ValueError('Missing labelled videos: '+str(sorted(set(labels)-set(available))))
    durations={}
    for key in labels:
        cap=cv2.VideoCapture(str(available[key]));fps=cap.get(cv2.CAP_PROP_FPS)
        durations[key]=cap.get(cv2.CAP_PROP_FRAME_COUNT)/fps if fps else 0;cap.release()
    longest=max(durations,key=durations.get)
    order=list(dict.fromkeys(DEBUG+[longest]))
    positive=sorted([k for k,v in labels.items() if v and k not in order],key=lambda k:int(k.split('-')[1]))
    negative=sorted([k for k,v in labels.items() if not v and k not in order],key=lambda k:int(k.split('-')[1]))
    while positive or negative:
        if positive:order.append(positive.pop(0))
        if negative:order.append(negative.pop(0))
    return order,available,durations


def quality(folder,ids):
    counts=score(ROOT/'labels.csv',folder,only=set(ids))['summary']
    matches=score_events(ROOT/'labels.csv',folder,only=set(ids),tolerance=2)['type_and_interval_matches']
    return (2*counts['misses']+counts['false_alarms']+2*counts['unprocessed'],-matches)


def reusable(path,run_hash,source_hash,revision):
    try:
        result=json.loads(Path(path).read_text(encoding='utf-8'));a=result['analysis']
        if a.get('full_pass_fingerprint')!=run_hash or a.get('source_sha256')!=source_hash or a.get('focused_revision')!=revision:return None
        validate_result(result)
        return result
    except (OSError,ValueError,KeyError,TypeError):return None


def one(key,path,folder,revision,run_hash):
    source_hash=hashlib.sha256(path.read_bytes()).hexdigest()
    target=folder/(key+'.json');cached=reusable(target,run_hash,source_hash,revision)
    if cached is not None:
        print('RESUME',key,'already complete',flush=True);return cached
    began=time.perf_counter()
    try:result=run_job(path,accepted_at=began,focused_revision=revision,context_size=4096 if revision=='v06' else 8192,audit_path=folder/(key+'.audit.json'))
    except AnalysisError as error:
        result=error.partial or {'verdict':None,'violations':[],'analysis':{'status':'failed','review_flags':[]}}
        result['analysis'].update(status='failed',error=str(error),runtime_sec=round(time.perf_counter()-began,3))
    result['analysis'].update(full_pass_fingerprint=run_hash,source_sha256=source_hash,focused_revision=revision)
    save(target,result);render_report(result,folder/(key+'.html'))
    print(key,'verdict:',result['verdict'],'seconds:',result['analysis']['runtime_sec'],'events:',len(result['violations']),flush=True)
    if result['analysis'].get('error'):print('FAILED:',result['analysis']['error'],flush=True)
    return result


def report(folder,ids):
    verdicts=score(ROOT/'labels.csv',folder,only=set(ids))
    events={str(t):score_events(ROOT/'labels.csv',folder,only=set(ids),tolerance=t) for t in (0,2)}
    save(folder/'scores.json',verdicts);save(folder/'event_scores.json',events)
    rules=json.loads((ROOT/'rules.json').read_text(encoding='utf-8'))['rules']
    modes={r['id']:r['mode'] for r in rules};by_type={}
    rows=list(csv.DictReader((ROOT/'labels.csv').read_text(encoding='utf-8-sig').splitlines()))
    for key in ids:
        labelled=[r for r in rows if r['video']==key and r.get('rule_id') and r.get('start_sec') and r.get('end_sec')]
        try:
            result=json.loads((folder/(key+'.json')).read_text(encoding='utf-8'))
            predicted=result['violations'] if result['analysis']['status']=='done' else []
        except (OSError,ValueError,KeyError):predicted=[]
        for rid in {r['rule_id'] for r in labelled}|{e['rule_id'] for e in predicted}:
            row=by_type.setdefault(rid,{'mode':modes.get(rid,'unknown'),'annotated':0,'reported':0,'matched_within_2s':0})
            truth=[r for r in labelled if r['rule_id']==rid];found=[e for e in predicted if e['rule_id']==rid]
            row['annotated']+=len(truth);row['reported']+=len(found);row['matched_within_2s']+=matches(found,truth,tolerance=2)
    save(folder/'per_type.json',by_type)
    readiness={'known_video_scores':verdicts['summary'],'missing_detect_citations':[r['id'] for r in rules if r['mode']=='detect' and not r.get('citation')],
               'new_angle_test':'not_established','public_api_test':'not_run_without_team_endpoint',
               'independent_accuracy':'not_established; these are development videos',
               'ready_to_claim_all_types':False}
    save(folder/'readiness.json',readiness)
    rows=''.join('<tr><td>'+html.escape(r['video'])+'</td><td>'+html.escape(r['result'])+'</td><td>'+str(r.get('seconds','-'))+'</td><td><a href="'+r['video']+'.html">Local evidence</a></td></tr>' for r in verdicts['videos'])
    page='<!doctype html><meta charset="utf-8"><title>Full development pass</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto}td,th{padding:10px;text-align:left}pre{white-space:pre-wrap}</style><h1>Full development pass</h1><p>Not independent accuracy. Keep evidence local.</p><pre>'+html.escape(json.dumps(readiness,indent=2))+'</pre><table><tr><th>Video</th><th>Outcome</th><th>Seconds</th><th>Review</th></tr>'+rows+'</table>'
    (folder/'index.html').write_text(page,encoding='utf-8')
    return verdicts


def run(videos,out,max_minutes=90,extra_videos=()):
    if not math.isfinite(max_minutes) or max_minutes<5:raise ValueError('Overall budget must be at least five minutes')
    began=time.perf_counter();run_hash=fingerprint();out=Path(out);out.mkdir(parents=True,exist_ok=True)
    manifest=out/'manifest.json'
    if manifest.is_file() and json.loads(manifest.read_text())['fingerprint']!=run_hash:
        raise ValueError('Detector code changed. Start a fresh comparison with --new-run; old results are preserved.')
    # Preflight before any long work. No model downloads and no cloud endpoint.
    if 'qwen3.5:4b' not in {m.get('name') for m in api('/api/tags',timeout=10).get('models',[])}:
        raise AnalysisError('Install/start the existing local qwen3.5:4b model before this pass')
    order,available,durations=ordered_ids(videos)
    save(manifest,{'fingerprint':run_hash,'ordered_ids':order,'model':'qwen3.5:4b','source_durations':durations})
    training=training_status(videos);save(out/'training_status.json',training)
    print('TRAINED MODELS:',json.dumps([{k:r[k] for k in ('kind','summary','deployment')} for r in training]),flush=True)
    candidate=out/'candidate_debug';candidate.mkdir(exist_ok=True)
    for key in DEBUG:
        if fingerprint()!=run_hash:raise RuntimeError('Detector changed during this run; stopping to avoid mixed results')
        one(key,available[key],candidate,'v06',run_hash)
    chosen='v06';baseline_usable=True
    for key in DEBUG:
        try:
            result=json.loads((BASELINE/(key+'.json')).read_text(encoding='utf-8'))
            baseline_usable &= result['analysis']['version']=='general-0.5-focused' and result['analysis']['model']=='qwen3.5:4b'
            validate_result(result)
        except (OSError,ValueError,KeyError,TypeError):baseline_usable=False
    if baseline_usable and quality(candidate,DEBUG)>quality(BASELINE,DEBUG):chosen='v05'
    selected=out/'selected';selected.mkdir(exist_ok=True)
    save(out/'selected_run.json',{'focused_revision':chosen,'context_size':4096 if chosen=='v06' else 8192,
        'selection_basis':'Four development clips: minimize 2*misses+false alarms+2*failed, then maximize type/time matches within 2s.',
        'not_independent_validation':True,'trained_binary_models_enabled':False})
    print('SELECTED FOR BROADER TEST:',chosen,flush=True)
    for index,key in enumerate(order,1):
        if time.perf_counter()-began>max_minutes*60-280:
            print('Overall time budget reached. Rerun the same command to resume.',flush=True);break
        if fingerprint()!=run_hash:raise RuntimeError('Detector changed during this run; stopping to avoid mixed results')
        if chosen=='v06' and key in DEBUG:
            shutil.copy2(candidate/(key+'.json'),selected/(key+'.json'))
            shutil.copy2(candidate/(key+'.html'),selected/(key+'.html'))
            if (candidate/(key+'.audit.json')).exists():shutil.copy2(candidate/(key+'.audit.json'),selected/(key+'.audit.json'))
        else:
            print('FULL PASS',index,'/',len(order),flush=True)
            one(key,available[key],selected,chosen,run_hash)
        counts=report(selected,order)['summary'];print('RUNNING TOTAL:',json.dumps(counts),flush=True)
    for i,path in enumerate(extra_videos):
        if time.perf_counter()-began>max_minutes*60-280:break
        one('extra-'+str(i+1),Path(path),selected,chosen,run_hash)
    final=report(selected,order)
    print('FINAL DEVELOPMENT RESULTS:',json.dumps(final['summary']),flush=True)
    print('RESULT PAGE:',selected/'index.html',flush=True)
    print('Remaining: human evidence review, a genuinely new angle, verified citations, public API test.',flush=True)
    return out


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--videos',type=Path,default=Path(r'C:\Users\Sanzhar\Downloads\open\open\videos'))
    parser.add_argument('--out',type=Path,default=ROOT/'full_pass'/'current')
    parser.add_argument('--new-run',action='store_true');parser.add_argument('--max-minutes',type=float,default=90)
    parser.add_argument('--extra-video',action='append',default=[])
    args=parser.parse_args()
    if args.new_run:args.out=ROOT/'full_pass'/time.strftime('%Y%m%d_%H%M%S')
    cv2.setNumThreads(2)
    run(args.videos,args.out,args.max_minutes,args.extra_video)
