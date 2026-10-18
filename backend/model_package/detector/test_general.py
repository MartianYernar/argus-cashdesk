"""General pipeline software checks; mocked inference is not an accuracy test."""
import base64
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

import general_pipeline as g
from pipeline import AnalysisError


class GeneralChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.video=self.root/'private-unseen-name.avi'
        writer=cv2.VideoWriter(str(self.video),cv2.VideoWriter_fourcc(*'MJPG'),10,(160,120))
        self.assertTrue(writer.isOpened())
        for i in range(30):
            image=np.zeros((120,160,3),np.uint8)
            image[:,20+i:35+i]=150
            writer.write(image)
        writer.release()

    def tearDown(self):
        self.temp.cleanup()

    def execute(self,rule_id='door_open',support='visible',detail_support='unclear'):
        calls=[]
        def fake(prompt,frames,deadline,schema):
            calls.append(prompt)
            self.assertNotIn('private-unseen-name',prompt)
            self.assertNotIn('labels.csv',prompt)
            if 'observations' in schema['properties']:
                return {'scene_summary':'Synthetic imagery only.','observations':[{
                    'rule_id':rule_id,'support':support,'evidence_index':1,
                    'region':'upper_left','observation':'Synthetic observation for software testing.'}]}
            self.assertEqual(len(frames),4)
            return {'support':detail_support,'evidence_index':0,'observation':'Synthetic detail result.'}
        with patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),patch.object(g,'query',side_effect=fake):
            result=g.analyze_video(self.video)
        return result,calls

    def test_direct_event_keeps_evidence_and_avoids_veto_call(self):
        result,calls=self.execute()
        self.assertEqual(len(calls),1)
        self.assertEqual(result['verdict'],'violation')
        self.assertTrue(result['analysis']['timeline_coverage_complete'])
        for frame in result['violations'][0]['evidence_frames']:
            self.assertTrue(base64.b64decode(frame['image_base64']).startswith(b'\xff\xd8'))
            self.assertLess(frame['timestamp_sec'],result['analysis']['duration_sec'])
        self.assertIsNone(result['violations'][0]['rule_citation'])

    def test_unclear_event_uses_automatic_crop_and_can_become_visible(self):
        result,calls=self.execute(support='unclear',detail_support='visible')
        self.assertEqual(len(calls),2)
        self.assertEqual(result['analysis']['candidates_checked'],1)
        self.assertEqual(result['verdict'],'violation')

    def test_review_only_and_unknown_events_do_not_invent_violations(self):
        for rule_id in ('id_not_seen','unclassified'):
            result,calls=self.execute(rule_id)
            self.assertEqual(result['verdict'],'no_violation')
            self.assertEqual(len(result['analysis']['review_flags']),1)
            self.assertEqual(len(calls),1)

    def test_invalid_category_fails_instead_of_returning_clean(self):
        with self.assertRaises(AnalysisError) as caught:
            self.execute('invented_law')
        self.assertIsNone(caught.exception.partial['verdict'])
        self.assertEqual(caught.exception.partial['analysis']['status'],'failed')

    def test_expired_queue_deadline_does_not_invoke_model(self):
        with patch.object(g,'api') as api:
            with self.assertRaises(AnalysisError) as caught:
                g.analyze_video(self.video,deadline_monotonic=0)
        api.assert_not_called()
        self.assertIsNone(caught.exception.partial['verdict'])

    def test_model_timeout_does_not_create_clean_verdict(self):
        with patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),patch.object(g,'query',side_effect=AnalysisError('Synthetic timeout')):
            with self.assertRaises(AnalysisError) as caught:
                g.analyze_video(self.video)
        self.assertFalse(caught.exception.partial['analysis']['timeline_coverage_complete'])
        self.assertIsNone(caught.exception.partial['verdict'])

    def test_motion_pair_preserves_boundaries(self):
        stamps=g.sample_times(10,20,[(12,1),(17,100),(18,2)])
        self.assertEqual(stamps,[10,16.5,17.5,20])
        self.assertEqual(stamps,sorted(stamps))
        self.assertEqual(len(g.sample_times(0,.1,[])),4)

    def test_slow_responses_merge_remaining_chunks_without_skipping_end(self):
        class Cap:
            def isOpened(self):return True
            def get(self,key):return 10 if key==cv2.CAP_PROP_FPS else 1450
            def release(self):pass
        clock=[100.]
        def fake_query(prompt,frames,deadline,schema):
            clock[0]+=25
            return {'scene_summary':'Synthetic scheduling test.','observations':[]}
        def fake_frame(cap,t,fps,**kwargs):
            return {'timestamp_sec':round(round(t*fps)/fps,3),'image_base64':'synthetic'}
        with patch.object(g.time,'perf_counter',side_effect=lambda:clock[0]),patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),patch.object(g.cv2,'VideoCapture',return_value=Cap()),patch.object(g,'motion_profile',return_value=[]),patch.object(g,'frame_at',side_effect=fake_frame),patch.object(g,'query',side_effect=fake_query):
            result=g.analyze_video(self.video,budget_sec=100)
        self.assertEqual(result['analysis']['sampled_times_sec'][0],0)
        self.assertEqual(result['analysis']['sampled_times_sec'][-1],144.9)
        self.assertTrue(result['analysis']['timeline_coverage_complete'])
        self.assertEqual(result['analysis']['windows_scanned'],2)
        self.assertEqual(result['analysis']['runtime_sec'],50)


if __name__=='__main__':
    unittest.main()
