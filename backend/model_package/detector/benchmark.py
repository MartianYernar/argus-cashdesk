"""Sequential practice benchmark. Prints scores, never bank descriptions or images."""
import argparse
import datetime
import html
import json
from pathlib import Path

from evaluate import score
from event_score import score_events
from pipeline import ROOT, AnalysisError, analyze_video, render_report


def run(ids, videos, output=None, analyzer=None):
    analyzer=analyzer or analyze_video
    keys=[k.upper().replace('\u0425','X') for k in ids]
    if len(keys)!=len(set(keys)):
        raise ValueError('Repeated video ID')
    available={p.stem.upper().replace('\u0425','X'):p for p in Path(videos).glob('*.mov')}
    missing=[k for k in keys if k not in available]
    if missing:
        raise ValueError('Missing files: '+', '.join(missing))
    stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    output=Path(output or ROOT/'benchmarks'/stamp)
    output.mkdir(parents=True,exist_ok=True)
    print('Practice benchmark; no model training. One video at a time.',flush=True)
    print('Run directory:',str(output.resolve()),flush=True)
    for index,key in enumerate(keys,1):
        print(f'\nVIDEO {index}/{len(keys)}: {key}',flush=True)
        try:
            result=analyzer(available[key],progress=lambda message:print('  '+message,flush=True),audit_path=output/(key+'.audit.json'))
        except AnalysisError as error:
            result=error.partial
            if result is None:
                result={'verdict':None,'violations':[],'analysis':{'status':'failed','runtime_sec':0,'error':str(error),'review_flags':[]}}
        (output/(key+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        render_report(result,output/(key+'.html'))
        partial=score(ROOT/'labels.csv',output,only={key})
        entry=partial['videos'][0]
        print('  Outcome:',entry['result'],'| Seconds:',result['analysis']['runtime_sec'],'| Events:',len(result['violations']),flush=True)
        if result['analysis'].get('inference_profile'):
            print('  Inference timing:',json.dumps(result['analysis']['inference_profile']),flush=True)
        if 'unknown_safe_frames' in result['analysis']:
            print('  Unknown safe state:',result['analysis']['unknown_safe_frames'],'of',result['analysis']['sampled_frames'],'sampled frames',flush=True)
            if result['analysis'].get('assessment_quality')=='insufficient_visual_evidence':
                print('  LOW VISUAL COVERAGE: this verdict is not a reliable visual assessment.',flush=True)
        if result['analysis'].get('error'):
            print('  Processing error:',result['analysis']['error'],flush=True)
        summary=score(ROOT/'labels.csv',output,only=set(keys))
        (output/'scores.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    summary=score(ROOT/'labels.csv',output,only=set(keys))
    print('\nPRACTICE RESULTS:',json.dumps(summary['summary']),flush=True)
    print('Video outcomes:',json.dumps([{k:r.get(k) for k in ('video','result','seconds','event_count')} for r in summary['videos']]),flush=True)
    event_diagnostics={str(t):score_events(ROOT/'labels.csv',output,only=set(keys),tolerance=t) for t in (0,2)}
    (output/'event_scores.json').write_text(json.dumps(event_diagnostics,indent=2),encoding='utf-8')
    event_summary={t:{k:v for k,v in report.items() if k not in ('videos','notes')} for t,report in event_diagnostics.items()}
    print('EVENT ANNOTATION MATCHES (diagnostic; 0s and 2s interval tolerances):',json.dumps(event_summary),flush=True)
    print('Human review is still needed: a correct video verdict may cite the wrong action.',flush=True)
    rows=[]
    for row in summary['videos']:
        key=row['video']
        rows.append('<tr><td>'+html.escape(key)+'</td><td>'+html.escape(row['expected'])+'</td><td>'+html.escape(str(row.get('predicted','failed')))+'</td><td>'+html.escape(row['result'])+'</td><td>'+str(row.get('seconds','—'))+'</td><td><a href="'+html.escape(key)+'.html">Review evidence</a></td></tr>')
    page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Practice benchmark results</title><style>body{background:#101719;color:#e5efec;font:16px/1.6 Segoe UI,sans-serif;margin:0}main{max-width:1100px;margin:auto;padding:28px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:14px;border-bottom:1px solid #39534a}a{color:#a6e6d1}pre{white-space:pre-wrap}</style><main><h1>Practice benchmark</h1><p>These videos are being used for development. This is not an independent accuracy estimate. A matching verdict alone does not establish correct event type, timing, evidence, or law.</p><pre>'''+html.escape(json.dumps(summary['summary'],indent=2))+'''</pre><table><thead><tr><th>Video</th><th>Expected</th><th>Predicted</th><th>Outcome</th><th>Seconds</th><th>Evidence</th></tr></thead><tbody>'''+''.join(rows)+'</tbody></table><p>Keep evidence pages and descriptions local. Share only numerical results and ratings.</p></main></html>'
    (output/'index.html').write_text(page,encoding='utf-8')
    print('Local overview:',str((output/'index.html').resolve()),flush=True)
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ids',nargs='+',default=['X-20','X-21'])
    parser.add_argument('--videos',type=Path,default=Path(r'C:\Users\Sanzhar\Downloads\open\open\videos'))
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    try:
        run(args.ids,args.videos,args.out)
    except (OSError,ValueError) as error:
        print('BENCHMARK FAILED:',str(error),flush=True)
        raise SystemExit(1)
