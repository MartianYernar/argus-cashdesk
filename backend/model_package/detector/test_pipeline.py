"""Software integrity checks using synthetic imagery, never bank footage."""
import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np

import evaluate
import pipeline


class PipelineIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.video = self.root / 'synthetic.avi'
        writer = cv2.VideoWriter(str(self.video), cv2.VideoWriter_fourcc(*'MJPG'), 10, (160, 120))
        self.assertTrue(writer.isOpened())
        for i in range(30):
            frame = np.zeros((120, 160, 3), dtype=np.uint8)
            cv2.circle(frame, (20 + i * 3, 60), 10, (0, 200, 100), -1)
            writer.write(frame)
        writer.release()

    def tearDown(self):
        self.temp.cleanup()

    def run_fake(self, rid='safe_open', supported=True):
        responses = [
            {'scene_summary': 'Synthetic test only.', 'candidates': [{'rule_id': rid, 'frame_index': 1, 'observation': 'Synthetic test claim.'}]},
            {'supported': supported, 'frame_index': 1, 'observation': 'Synthetic check.', 'uncertainty': ''},
        ]
        with patch.object(pipeline, 'api', return_value={'models': [{'name': pipeline.MODEL}]}), patch.object(pipeline, 'ask', side_effect=responses):
            return pipeline.analyze_video(self.video)

    def test_confirmed_event_has_real_jpeg_and_bounded_timestamp(self):
        result = self.run_fake()
        self.assertEqual(result['verdict'], 'violation')
        self.assertEqual(result['analysis']['status'], 'done')
        event = result['violations'][0]
        self.assertGreaterEqual(event['timecode_sec'], 0)
        self.assertLess(event['timecode_sec'], result['analysis']['duration_sec'])
        for frame in event['evidence_frames']:
            self.assertTrue(base64.b64decode(frame['image_base64'], validate=True).startswith(b'\xff\xd8'))
        self.assertIsNone(event['rule_citation'])

    def test_review_only_claim_does_not_become_verified_violation(self):
        result = self.run_fake('id_not_seen')
        self.assertEqual(result['verdict'], 'no_violation')
        self.assertEqual(len(result['analysis']['review_flags']), 1)

    def test_rejected_claim_does_not_enter_verdict(self):
        self.assertEqual(self.run_fake(supported=False)['violations'], [])

    def test_invented_rule_fails_job_instead_of_becoming_clean(self):
        with self.assertRaises(pipeline.AnalysisError) as caught:
            self.run_fake('invented_law')
        self.assertEqual(caught.exception.partial['analysis']['status'], 'failed')
        self.assertIsNone(caught.exception.partial['verdict'])

    def test_timeout_does_not_return_clean_verdict(self):
        with patch.object(pipeline, 'api', return_value={'models': [{'name': pipeline.MODEL}]}), patch.object(pipeline, 'ask', side_effect=pipeline.AnalysisError('Time budget exhausted')):
            with self.assertRaises(pipeline.AnalysisError) as caught:
                pipeline.analyze_video(self.video)
        self.assertIsNone(caught.exception.partial['verdict'])

    def test_missing_or_late_result_stays_in_accuracy_denominator(self):
        labels = self.root / 'labels.csv'
        labels.write_text('video,verdict,start_sec,end_sec\nX-1,violation,1,2\nX-2,no_violation,,\n', encoding='utf-8')
        pred = self.run_fake()
        pred['analysis']['runtime_sec'] = 300
        (self.root / 'X-1.json').write_text(json.dumps(pred), encoding='utf-8')
        summary = evaluate.score(labels, self.root)['summary']
        self.assertEqual(summary['total'], 2)
        self.assertEqual(summary['unprocessed'], 2)
        self.assertEqual(summary['correct_fraction_all_expected'], 0)

    def test_sampling_reaches_end_without_gaps_between_windows(self):
        for duration in (2, 6, 7, 16, 17, 30, 145):
            starts = pipeline.window_starts(duration)
            self.assertEqual(starts[0], 0)
            self.assertGreaterEqual(starts[-1] + 6, duration)
            self.assertTrue(all(b-a <= 6 for a, b in zip(starts, starts[1:])))

    def test_default_sampling_gap_is_no_more_than_two_seconds(self):
        for duration in (7, 26, 145):
            stamps = sorted({start + (min(duration,start+6)-start)*i/3 for start in pipeline.window_starts(duration) for i in range(4)})
            self.assertLessEqual(max(b-a for a,b in zip(stamps,stamps[1:])), 2.0001)

    def test_truncated_json_fails_even_if_http_succeeded(self):
        import time
        with patch.object(pipeline, 'api', return_value={'done_reason': 'length', 'message': {'content': '{"supported":tru'}}):
            with self.assertRaises(pipeline.AnalysisError):
                pipeline.ask('Synthetic prompt', [], time.perf_counter()+30, pipeline.VERIFY_SCHEMA)

    def test_complete_json_at_token_cap_is_not_discarded(self):
        import time
        payload = {'supported': False, 'frame_index': 0, 'observation': 'Unclear.', 'uncertainty': 'Not visible.'}
        with patch.object(pipeline, 'api', return_value={'done_reason': 'length', 'message': {'content': json.dumps(payload)}}):
            answer = pipeline.ask('Synthetic prompt', [], time.perf_counter()+30, pipeline.VERIFY_SCHEMA)
        self.assertEqual(answer, payload)

    def test_motion_probe_uses_dense_inputs_without_expected_class(self):
        import probe_motion
        moved = self.root / 'X-1.mov'
        moved.write_bytes(self.video.read_bytes())
        (self.root/'labels.csv').write_text('video,start_sec,end_sec,rule_id\nX-1,1,2,SECRET_MARKED_CLASS\n',encoding='utf-8')
        calls=[]
        def fake(prompt,frames,deadline,schema):
            self.assertNotIn('SECRET_MARKED_CLASS',prompt)
            calls.append([f['timestamp_sec'] for f in frames])
            return {'visible_movement':'Synthetic only.','distinct_cash_paths':'unclear','destination':'unclear','uncertainty':'Test.'}
        with patch.object(probe_motion,'ROOT',self.root), patch.object(probe_motion,'ask',side_effect=fake), patch('builtins.print'):
            probe_motion.run('X-1',self.root)
        self.assertGreater(len(calls),1)
        self.assertTrue(all(max(b-a for a,b in zip(group,group[1:]))<=0.31 for group in calls[1:]))
        self.assertTrue((self.root/'motion_probe'/'X-1.html').is_file())

    def test_crop_uses_original_pixels_before_resize(self):
        cap=cv2.VideoCapture(str(self.video))
        try:
            frame=pipeline.frame_at(cap,1,10,roi=[0.25,0.25,0.75,0.75])
            image=cv2.imdecode(np.frombuffer(base64.b64decode(frame['image_base64']),dtype=np.uint8),cv2.IMREAD_COLOR)
            self.assertEqual(image.shape[:2],(60,80))
            with self.assertRaises(pipeline.AnalysisError):
                pipeline.frame_at(cap,1,10,roi=[0.8,0,0.2,1])
        finally:
            cap.release()

    def test_benchmark_preserves_failure_and_scores_clean_control(self):
        import benchmark
        for key in ('X-20','X-21'):
            (self.root/(key+'.mov')).write_bytes(self.video.read_bytes())
        (self.root/'labels.csv').write_text('video,verdict,start_sec,end_sec\nX-20,violation,1,2\nX-21,no_violation,,\n',encoding='utf-8')
        clean={'verdict':'no_violation','violations':[],'analysis':{'status':'done','runtime_sec':1,'duration_sec':3,'windows_scanned':1,'windows_total':1,'review_flags':[]}}
        with patch.object(benchmark,'ROOT',self.root),patch.object(benchmark,'analyze_video',side_effect=[pipeline.AnalysisError('Synthetic failure'),clean]),patch('builtins.print'):
            summary=benchmark.run(['X-20','X-21'],self.root,self.root/'batch')
        self.assertEqual(summary['summary']['unprocessed'],1)
        self.assertEqual(summary['summary']['correct'],1)
        self.assertEqual(summary['summary']['total'],2)
        self.assertTrue((self.root/'batch'/'index.html').is_file())

    def test_recheck_preserves_latest_proposal_sequence(self):
        calls=[]
        def fake(prompt,frames,deadline,schema):
            calls.append([f['timestamp_sec'] for f in frames])
            if schema is pipeline.SCAN_SCHEMA:
                return {'scene_summary':'Synthetic.','candidates':[{'rule_id':'safe_open','frame_index':1,'observation':'Synthetic.'}]}
            return {'supported':True,'frame_index':1,'observation':'Synthetic.','uncertainty':''}
        with patch.object(pipeline,'api',return_value={'models':[{'name':pipeline.MODEL}]}),patch.object(pipeline,'window_starts',return_value=[0,1]),patch.object(pipeline,'ask',side_effect=fake):
            result=pipeline.analyze_video(self.video)
        self.assertEqual(len(calls),3)
        self.assertEqual(calls[-1],calls[1])
        self.assertEqual(result['violations'][0]['timecode_sec'],calls[1][1])

    def test_safe_state_rule_does_not_flag_active_access_or_unknown(self):
        from state_baseline import event_runs
        def state(t,door,position):
            return {'timestamp_sec':t,'safe_door':door,'cashier_position':position}
        self.assertEqual(event_runs([state(0,'open','at_safe'),state(1,'open','at_safe'),state(2,'closed','at_desk')]),[])
        self.assertEqual(event_runs([state(0,'open','at_desk'),state(1,'unknown','at_desk'),state(2,'open','at_desk')]),[])
        self.assertEqual(event_runs([state(0,'open','at_desk')]),[])
        self.assertEqual(len(event_runs([state(1.003,'open','at_desk'),state(1.999,'open','at_desk')])),1)

    def test_safe_state_pipeline_uses_states_without_verifier(self):
        import state_baseline
        calls=[]
        def fake(prompt,frames,deadline,schema):
            calls.append(prompt)
            return {'states':[{'frame_index':i,'safe_door':'open','cashier_position':'at_desk'} for i in range(len(frames))]}
        with patch.object(state_baseline,'ask',side_effect=fake):
            result=state_baseline.analyze_safe_video(self.video)
        self.assertEqual(result['verdict'],'violation')
        self.assertEqual(len(calls),result['analysis']['windows_total'])
        self.assertEqual(result['analysis']['unknown_safe_frames'],0)
        self.assertEqual(result['analysis']['candidates_checked'],0)

    def test_cropped_safe_states_pair_overview_and_crop_per_moment(self):
        import state_baseline
        calls=[]
        def fake(prompt,frames,deadline,schema):
            n=schema['properties']['states']['maxItems']
            self.assertEqual(len(frames),2*n)
            self.assertLessEqual(len(frames),4)
            self.assertIn('safe_closeup_image_index',prompt)
            calls.append(n)
            return {'states':[{'frame_index':i,'safe_door':'unknown','cashier_position':'at_desk'} for i in range(n)]}
        with patch.object(state_baseline,'ask',side_effect=fake):
            result=state_baseline.analyze_safe_video(self.video,roi=[0.25,0.25,0.75,0.75])
        self.assertEqual(result['analysis']['sampled_frames'],sum(calls))
        self.assertEqual(result['analysis']['assessment_quality'],'insufficient_visual_evidence')

    def test_auto_localization_validates_boxes_and_does_not_use_labels(self):
        import auto_safe
        with self.assertRaises(pipeline.AnalysisError):
            auto_safe.validate_box({'found':False,'box_xyxy_1000':[0,0,0,0]},160,120)
        with self.assertRaises(pipeline.AnalysisError):
            auto_safe.validate_box({'found':True,'box_xyxy_1000':[900,0,100,1000]},160,120)
        def fake(prompt,frames,deadline,schema):
            self.assertNotIn('synthetic.avi',prompt)
            self.assertNotIn('X-20',prompt)
            self.assertEqual(len(frames),3)
            return {'found':True,'box_xyxy_1000':[250,250,750,750]}
        import time
        with patch.object(auto_safe,'ask',side_effect=fake):
            located=auto_safe.locate_safe(self.video,time.perf_counter()+30)
        self.assertEqual(located['roi'],[0.225,0.225,0.775,0.775])
        self.assertTrue(base64.b64decode(located['preview_frame']['image_base64']).startswith(b'\xff\xd8'))

    def test_failed_auto_localization_cannot_return_clean_verdict(self):
        import auto_safe
        with patch.object(auto_safe,'locate_safe',side_effect=pipeline.AnalysisError('Synthetic localization failure')):
            with self.assertRaises(pipeline.AnalysisError) as caught:
                auto_safe.analyze_auto_safe_video(self.video)
        self.assertIsNone(caught.exception.partial['verdict'])
        self.assertEqual(caught.exception.partial['analysis']['status'],'failed')


if __name__ == '__main__':
    unittest.main()
