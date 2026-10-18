import json
import subprocess
import time
import unittest
from unittest.mock import patch
import job_worker as w
from pipeline import AnalysisError


class WorkerChecks(unittest.TestCase):
    def result(self):return {'verdict':'no_violation','violations':[],'analysis':{'status':'done','duration_sec':10,'runtime_sec':1,'windows_scanned':1,'windows_total':1}}

    def test_expired_queue_does_not_start_worker(self):
        with patch.object(w.subprocess,'run') as run:
            with self.assertRaises(AnalysisError):w.run_job('unused.mov',accepted_at=time.perf_counter()-300)
        run.assert_not_called()

    def test_timeout_is_failed_not_clean(self):
        with patch.object(w.subprocess,'run',side_effect=subprocess.TimeoutExpired(['synthetic'],1)):
            with self.assertRaisesRegex(AnalysisError,'Hard process'):w.run_job('unused.mov')

    def test_valid_worker_result_and_queue_time(self):
        process=subprocess.CompletedProcess([],0,json.dumps({'ok':True,'result':self.result()}).encode(),b'')
        with patch.object(w.subprocess,'run',return_value=process) as call:
            result=w.run_job('unused.mov',accepted_at=time.perf_counter()-5)
        self.assertGreaterEqual(result['analysis']['accepted_job_wall_sec'],5)
        self.assertLess(call.call_args.kwargs['timeout'],276)
        self.assertEqual(call.call_args.kwargs['env']['FORTE_LOCAL_MODEL'],'qwen3.5:4b')

    def test_malformed_json_and_invalid_verdict_are_failures(self):
        malformed=subprocess.CompletedProcess([],0,b'not JSON',b'')
        with patch.object(w.subprocess,'run',return_value=malformed):
            with self.assertRaises(AnalysisError):w.run_job('unused.mov')
        result=self.result();result['verdict']='violation'
        with self.assertRaises(ValueError):w.validate_result(result)


if __name__=='__main__':unittest.main()
