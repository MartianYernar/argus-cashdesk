import copy
import unittest
from unittest.mock import patch
import submission as s
from test_public_contract import complete


def internal():
    public=complete()
    return {'verdict':public['verdict'],'violations':copy.deepcopy(public['violations']),
            'analysis':{'status':'done','duration_sec':10,'runtime_sec':1,
                        'windows_scanned':1,'windows_total':1}}


class FinalAdapterTests(unittest.TestCase):
    def test_success_returns_official_fields_and_pins_measured_settings(self):
        with patch.object(s,'run_job',return_value=internal()) as worker:
            result=s.analyze_video('test.mov',job_id='job-1')
        self.assertEqual(result,complete())
        for key,value in [('model','qwen3.5:4b'),('context_size',4096),('focused_revision','v06')]:
            self.assertEqual(worker.call_args.kwargs[key],value)

    def test_errors_and_partial_positive_results_are_failed_without_verdict(self):
        for error in (s.AnalysisError('timeout',internal()),TimeoutError('timeout'),OSError('decode failed')):
            with self.subTest(error=type(error).__name__),patch.object(s,'run_job',side_effect=error),self.assertLogs('submission',level='ERROR'):
                result=s.analyze_video('test.mov',job_id='job-1')
            self.assertEqual(result,{'job_id':'job-1','status':'failed'})

    def test_malformed_worker_result_is_failed(self):
        with patch.object(s,'run_job',return_value={'verdict':'no_violation'}),self.assertLogs('submission',level='ERROR'):
            self.assertEqual(s.analyze_video('test.mov',job_id='job-1')['status'],'failed')

    def test_queue_acceptance_is_preserved_and_deadline_includes_formatting(self):
        with patch.object(s,'run_job',return_value=internal()) as worker,patch.object(s.time,'perf_counter',return_value=281),self.assertLogs('submission',level='ERROR'):
            result=s.analyze_video('test.mov',job_id='job-1',accepted_at=0)
        self.assertEqual(worker.call_args.kwargs['accepted_at'],0)
        self.assertEqual(result,{'job_id':'job-1','status':'failed'})

    def test_invalid_configuration_never_calls_model(self):
        for args in ({'budget_sec':300},{'budget_sec':float('nan')},{'focused_revision':'v05'},{'context_size':8192}):
            with self.subTest(args=args),patch.object(s,'run_job') as worker,self.assertLogs('submission',level='ERROR'):
                result=s.analyze_video('test.mov',job_id='job-1',**args)
            worker.assert_not_called();self.assertEqual(result['status'],'failed')

    def test_clean_completed_result_is_allowed(self):
        result=internal();result.update(verdict='no_violation',violations=[])
        with patch.object(s,'run_job',return_value=result):
            answer=s.analyze_video('test.mov',job_id='job-1')
        self.assertEqual(answer,{'job_id':'job-1','status':'done','verdict':'no_violation','violations':[]})

if __name__=='__main__':unittest.main()
