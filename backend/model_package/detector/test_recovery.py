"""Regression checks for deadline allocation and truncated MOV tails."""
import time
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import cv2
import numpy as np
import general_pipeline as g
import pipeline as p
from evaluate import score
from test_general import GeneralChecks


class Capture:
    def __init__(self,broken):self.position=0;self.broken=set(broken)
    def set(self,key,value):self.position=int(value);return True
    def get(self,key):return 510
    def read(self):
        if self.position in self.broken:return False,None
        return True,np.full((40,40,3),self.position%255,np.uint8)


class RecoveryChecks(unittest.TestCase):
    def test_motion_gap_is_optional_and_does_not_bridge_a_jump(self):
        values=g.motion_profile(Capture([10]),10,2,time.perf_counter()+10)
        self.assertEqual([t for t,_ in values],[.5,2.0])

    def test_tail_evidence_uses_actual_decodable_timestamp(self):
        frame=p.frame_at(Capture([508,509]),509/30,30)
        self.assertEqual(frame['timestamp_sec'],16.9)

    def test_interior_decode_failure_is_not_silently_substituted(self):
        with self.assertRaises(p.AnalysisError):p.frame_at(Capture([100]),100/30,30)

    def test_all_broken_tail_frames_still_fail(self):
        with self.assertRaises(p.AnalysisError):
            p.frame_at(Capture(range(500,510)),509/30,30)

    def test_verification_reserve_reduces_scan_count(self):
        self.assertLess(g.remaining_windows(200,10,16,reserve=140),
                        g.remaining_windows(200,10,16,reserve=35))

    def test_expired_motion_sampling_still_fails(self):
        with self.assertRaises(p.AnalysisError):g.motion_profile(Capture([]),10,2,0)

    def test_report_separates_attempted_failure_from_pending(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'labels.csv').write_text('video,verdict,start_sec,end_sec\nX-1,violation,,\nX-2,no_violation,,\n')
            (root/'X-1.json').write_text(json.dumps({'analysis':{'status':'failed','runtime_sec':1}}))
            counts=score(root/'labels.csv',root)['summary']
        self.assertEqual((counts['attempted'],counts['failed'],counts['pending']),(1,1,1))
        self.assertEqual(counts['correct'],0)


class BudgetIntegration(GeneralChecks):
    def execute_budget(self,confirmed):
        clock=[100.]
        def query(prompt,frames,deadline,schema):
            if 'events' in schema['properties']:
                clock[0]+=5
                return {'events':[{'rule_id':rid,'support':'visible','evidence_index':0}
                                  for rid in ('cash_unattended','envelope_unattended')]}
            clock[0]+=20
            return {'conditions':{k:('yes' if confirmed else 'no')
                                  for k in schema['properties']['conditions']['required']},
                    'before_index':0,'after_index':len(frames)-1,'evidence_index':len(frames)-1}
        with patch.object(g.time,'perf_counter',side_effect=lambda:clock[0]),\
             patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),\
             patch.object(g,'query',side_effect=query):
            return g.analyze_video(self.video,budget_sec=30,focused_checks=True)

    def test_verified_positive_survives_unfinished_extra_candidates(self):
        result=self.execute_budget(True)
        self.assertEqual(result['verdict'],'violation')
        self.assertTrue(result['analysis']['verification_incomplete'])
        self.assertEqual(result['analysis']['unchecked_candidates'],1)

    def test_unfinished_checks_cannot_become_clean(self):
        with self.assertRaises(p.AnalysisError) as caught:self.execute_budget(False)
        self.assertIsNone(caught.exception.partial['verdict'])


if __name__=='__main__':unittest.main()
