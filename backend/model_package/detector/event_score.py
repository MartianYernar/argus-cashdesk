"""Diagnostic annotation matching; not the judges' unpublished event metric."""
import csv
import io
import json
from collections import defaultdict
from pathlib import Path


def matches(events,labels,tolerance=0):
    links=[]
    for event in events:
        eligible=[]
        for index,label in enumerate(labels):
            distance=max(float(label['start_sec'])-event['timecode_sec'],event['timecode_sec']-float(label['end_sec']),0)
            if event.get('rule_id')==label['rule_id'] and distance<=tolerance:eligible.append((distance,index))
        links.append([index for _,index in sorted(eligible)])
    assigned={}
    def assign(event_index,seen):
        for label_index in links[event_index]:
            if label_index in seen:continue
            seen.add(label_index)
            if label_index not in assigned or assign(assigned[label_index],seen):
                assigned[label_index]=event_index
                return True
        return False
    for i in range(len(events)):assign(i,set())
    return len(assigned)


def score_events(label_path,predictions,only=None,tolerance=0):
    grouped=defaultdict(list)
    reader=csv.DictReader(io.StringIO(Path(label_path).read_text(encoding='utf-8-sig')))
    if not {'rule_id','start_sec','end_sec'}.issubset(reader.fieldnames or []):
        return {'available':False,'reason':'Labels lack event type or interval columns.'}
    for row in reader:
        key=row['video'].upper().replace('\u0425','X')
        if only is None or key in only:grouped[key].append(row)
    expected=predicted=matched=0
    videos=[]
    for key,rows in sorted(grouped.items()):
        annotated=[r for r in rows if r['rule_id'] and r['start_sec'] and r['end_sec']]
        expected+=len(annotated)
        events=[]
        try:
            result=json.loads((Path(predictions)/(key+'.json')).read_text(encoding='utf-8'))
            if result['analysis']['status']=='done' and result['analysis']['runtime_sec']<300:
                events=result['violations']
        except (OSError,ValueError,KeyError,TypeError):pass
        count=matches(events,annotated,tolerance)
        predicted+=len(events);matched+=count
        videos.append({'video':key,'annotated_events':len(annotated),'reported_events':len(events),'type_and_interval_matches':count})
    return {'annotated_events':expected,'reported_events':predicted,'type_and_interval_matches':matched,
            'unmatched_reported_events':predicted-matched,'unmatched_annotations':expected-matched,
            'annotation_match_precision':matched/predicted if predicted else None,
            'annotation_match_recall':matched/expected if expected else None,
            'interval_tolerance_sec':tolerance,'videos':videos,
            'notes':['Diagnostic one-to-one rule-ID and interval matching; not official judging.',
                     'Unmatched predictions require human review; annotations can be incomplete.',
                     'This does not validate screenshots, legal applicability, or unseen angles.']}
