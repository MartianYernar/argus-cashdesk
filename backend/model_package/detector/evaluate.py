"""Score full-video outputs. Missing, failed, or late jobs never count as correct."""
import argparse
import csv
import io
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def score(labels, predictions, only=None):
    grouped = defaultdict(list)
    for row in csv.DictReader(io.StringIO(Path(labels).read_text(encoding='utf-8-sig'))):
        key = row['video'].strip().upper().replace('\u0425', 'X')
        if only is None or key in only:
            grouped[key].append(row)
    counts = {'correct': 0, 'misses': 0, 'false_alarms': 0, 'unprocessed': 0, 'processed': 0, 'total': len(grouped),
              'attempted':0,'failed':0,'pending':0}
    details = []
    for key, rows in sorted(grouped.items()):
        expected = 'violation' if any(r['verdict'] == 'violation' for r in rows) else 'no_violation'
        item = {'video': key, 'expected': expected}
        target=Path(predictions)/(key+'.json')
        exists=target.is_file()
        counts['attempted' if exists else 'pending']+=1
        try:
            pred = json.loads(target.read_text(encoding='utf-8'))
            meta = pred['analysis']
            runtime = meta['runtime_sec']
            if not isinstance(runtime, (int, float)) or not math.isfinite(runtime) or not 0 <= runtime < 300:
                raise ValueError('Late or invalid runtime')
            if meta['status'] != 'done' or meta['windows_scanned'] != meta['windows_total'] or meta['windows_total'] <= 0:
                raise ValueError('Incomplete processing')
            verdict = pred['verdict']
            events = pred['violations']
            if verdict not in ('violation', 'no_violation') or not isinstance(events, list) or (verdict == 'violation') != bool(events):
                raise ValueError('Invalid verdict/events')
            for event in events:
                if not isinstance(event['type'], str) or not isinstance(event['description'], str):
                    raise ValueError('Invalid event text')
                timestamp = event['timecode_sec']
                if not isinstance(timestamp, (int, float)) or not math.isfinite(timestamp) or not 0 <= timestamp < meta['duration_sec']:
                    raise ValueError('Invalid timestamp')
                frames = event['evidence_frames']
                if not isinstance(frames, list) or not 1 <= len(frames) <= 3 or not all(f.get('image_base64') for f in frames):
                    raise ValueError('Missing evidence')
            counts['processed'] += 1
            item.update({'predicted': verdict, 'seconds': runtime, 'event_count': len(events), 'review_flags': len(meta.get('review_flags', []))})
            if verdict == expected:
                counts['correct'] += 1
                item['result'] = 'correct'
            elif expected == 'violation':
                counts['misses'] += 1
                item['result'] = 'miss'
            else:
                counts['false_alarms'] += 1
                item['result'] = 'false_alarm'
            # Interval distance is diagnostic only, not the judges' unpublished time tolerance.
            positive_rows = [r for r in rows if r['start_sec'] and r['end_sec']]
            if events and positive_rows:
                item['nearest_annotated_interval_distance_sec'] = round(min(
                    max(float(r['start_sec']) - e['timecode_sec'], e['timecode_sec'] - float(r['end_sec']), 0)
                    for e in events for r in positive_rows), 3)
        except (OSError, ValueError, KeyError, TypeError) as error:
            counts['unprocessed'] += 1
            if exists:counts['failed']+=1
            item.update({'result': 'unprocessed', 'processing_state':'failed' if exists else 'pending','reason': str(error)})
        details.append(item)
    counts['correct_fraction_all_expected'] = counts['correct'] / counts['total'] if counts['total'] else None
    return {'summary': counts, 'videos': details, 'notes': [
        'Practice results, not held-out accuracy. No detection quality established by software tests.',
        'Duplicates X-4/X-47 and X-5/X-48 must remain in the same split.',
        'Review-only event types do not trigger the verdict and may therefore appear as misses.',
        'Team timestamps/types may be approximate or incomplete; evidence_sec in X-38 extra row is inconsistent with its start/end.',
    ]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--labels', type=Path, default=ROOT / 'labels.csv')
    parser.add_argument('--preds', type=Path, default=ROOT / 'results')
    parser.add_argument('--only', nargs='+', help='Only score these video IDs; all labels are expected otherwise')
    args = parser.parse_args()
    only = {s.upper().replace('\u0425', 'X') for s in args.only} if args.only else None
    report = score(args.labels, args.preds, only)
    print(json.dumps(report, indent=2, ensure_ascii=True))
