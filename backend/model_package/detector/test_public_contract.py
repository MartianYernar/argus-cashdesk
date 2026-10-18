import base64
import copy
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import api_smoke
from public_contract import public_result,validate_public_job


def complete():
    return {'job_id':'job-1','status':'done','verdict':'violation','violations':[{
        'type':'Synthetic physical event','timecode_sec':1.,'description':'Synthetic test.',
        'evidence_frames':[{'timestamp_sec':1.,'image_base64':base64.b64encode(b'\xff\xd8synthetic\xff\xd9').decode()}]}]}


class PublicContractChecks(unittest.TestCase):
    def test_official_envelope_needs_no_internal_analysis(self):
        self.assertEqual(validate_public_job(complete(),'job-1')['status'],'done')

    def test_pending_and_failed_are_accepted_as_states(self):
        for state in ('processing','failed'):
            validate_public_job({'job_id':'job-1','status':state},'job-1')

    def test_invalid_status_wrong_job_and_bad_verdict_fail(self):
        for change in ({'status':'queued'},{'job_id':'job-2'},{'verdict':'no_violation'},{'violations':[]}):
            payload={**complete(),**change}
            with self.assertRaises(ValueError):validate_public_job(payload,'job-1')

    def test_invalid_times_and_jpeg_fail(self):
        for field,value in [('timecode_sec',True),('timecode_sec',float('nan')),('timecode_sec',-1),('type','')]:
            payload=complete();payload['violations'][0][field]=value
            with self.assertRaises(ValueError):validate_public_job(payload)
        for value in ('data:image/jpeg;base64,abc','not base64','YWJj'):
            payload=complete();payload['violations'][0]['evidence_frames'][0]['image_base64']=value
            with self.assertRaises(ValueError):validate_public_job(payload)

    def test_adapter_strips_diagnostics_without_losing_required_fields(self):
        payload=complete();engine={'verdict':payload['verdict'],'violations':copy.deepcopy(payload['violations']),
            'analysis':{'status':'done','duration_sec':10,'runtime_sec':1,'windows_scanned':1,'windows_total':1}}
        engine['violations'][0]['internal_debug']='private'
        self.assertEqual(public_result('job-1',engine),payload)

    def test_api_checker_exercises_both_auth_routes_and_public_contract(self):
        calls=[]
        class Response:
            status=200
            def __init__(self,payload):self.data=json.dumps(payload).encode()
            def read(self,*args):return self.data
            def __enter__(self):return self
            def __exit__(self,*args):pass
        class Opener:
            def add_handler(self,*args):pass
            def open(self,request,**kwargs):
                calls.append((request.get_method(),request.full_url,request.has_header('X-api-key')))
                if request.get_header('X-api-key')!='test-only':
                    import urllib.error
                    raise urllib.error.HTTPError(request.full_url,401,'Unauthorized',{},None)
                if request.get_method()=='POST':return Response({'job_id':'job-1'})
                return Response(complete())
        with tempfile.TemporaryDirectory() as folder:
            video=Path(folder)/'test.mov';video.write_bytes(b'synthetic upload fixture')
            with patch.dict(os.environ,FORTE_API_KEY='test-only'),patch.object(api_smoke.urllib.request,'OpenerDirector',return_value=Opener()):
                result=api_smoke.run('http://team.local',video)
        self.assertTrue(result['result_contract_passed'])
        self.assertEqual(len(calls),5)
        self.assertEqual([c[2] for c in calls],[False,True,False,True,True])


if __name__=='__main__':unittest.main()
