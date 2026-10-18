"""Run only against the team's own API; uploads one local MOV to that service.

API key is read from an environment variable and never printed. Validates the
organizer's public envelope; engine-only analysis fields are not required.
"""
import argparse
import json
import os
from pathlib import Path
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from public_contract import validate_public_job


def run(url,video,key_env='FORTE_API_KEY',upload_field='file'):
    parsed=urllib.parse.urlparse(url)
    if parsed.scheme not in ('http','https') or not parsed.netloc or parsed.username or parsed.query or parsed.fragment:
        raise ValueError('Use the team API base URL without embedded credentials/query parameters')
    key=os.environ.get(key_env)
    if not key:raise ValueError('Set the API-key environment variable first')
    video=Path(video)
    if video.suffix.lower()!='.mov':raise ValueError('Supply a local .mov file')
    if any(c in upload_field for c in '\r\n"'):raise ValueError('Invalid multipart field')
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT);context.load_default_certs()
    opener=urllib.request.OpenerDirector()
    opener.add_handler(urllib.request.HTTPHandler());opener.add_handler(urllib.request.HTTPSHandler(context=context))
    opener.add_handler(urllib.request.HTTPDefaultErrorHandler());opener.add_handler(urllib.request.HTTPErrorProcessor())
    # Deliberately no redirect handler: never forward an API key elsewhere.
    started=time.perf_counter();deadline=started+300
    def request(path,body=None,authorized=True,content_type=None,key_override=None):
        headers={'Accept':'application/json'}
        if authorized:headers['X-API-Key']=key if key_override is None else key_override
        if content_type:headers['Content-Type']=content_type
        req=urllib.request.Request(url.rstrip('/')+path,data=body,headers=headers)
        try:
            with opener.open(req,timeout=max(.1,deadline-time.perf_counter())) as response:
                return response.status,json.load(response)
        except urllib.error.HTTPError as error:return error.code,None
    boundary='forte-'+uuid.uuid4().hex
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="{upload_field}"; filename="test.mov"\r\nContent-Type: video/quicktime\r\n\r\n'.encode()
          +video.read_bytes()+f'\r\n--{boundary}--\r\n'.encode())
    content_type='multipart/form-data; boundary='+boundary
    unauthorized,_=request('/api/v1/analyze',body,authorized=False,content_type=content_type)
    if unauthorized not in (401,403):raise ValueError('Upload endpoint did not reject a request without X-API-Key')
    status,job=request('/api/v1/analyze',body,content_type=content_type)
    if status not in (200,201,202) or not isinstance(job,dict):raise RuntimeError('Upload failed: HTTP '+str(status))
    job_id=job.get('job_id')
    if not isinstance(job_id,str) or not job_id:raise ValueError('Upload response has no string job_id')
    path='/api/v1/jobs/'+urllib.parse.quote(str(job_id),safe='')
    unauthorized,_=request(path,authorized=False)
    if unauthorized not in (401,403):raise ValueError('Job endpoint did not reject a request without X-API-Key')
    unauthorized,_=request(path,key_override='invalid-'+uuid.uuid4().hex)
    if unauthorized not in (401,403):raise ValueError('Job endpoint did not reject an incorrect API key')
    while time.perf_counter()<deadline:
        status,payload=request(path)
        if status!=200 or not isinstance(payload,dict):raise RuntimeError('Polling failed: HTTP '+str(status))
        validate_public_job(payload,job_id)
        if payload['status']=='failed':raise RuntimeError('Server marked the job failed')
        if payload['status']=='done':
            elapsed=time.perf_counter()-started
            if elapsed>=300:raise RuntimeError('API completed too late')
            return {'auth_enforced':True,'result_contract_passed':True,'wall_clock_sec':round(elapsed,3),
                    'under_300_seconds':True,'event_count':len(payload['violations']),
                    'scope':'One upload; recognition and concurrent-load performance not established.'}
        time.sleep(min(1,max(0,deadline-time.perf_counter())))
    raise TimeoutError('API job did not finish within five minutes from upload start')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',required=True)
    parser.add_argument('--video',type=Path,required=True);parser.add_argument('--key-env',default='FORTE_API_KEY')
    parser.add_argument('--upload-field',default='file');args=parser.parse_args()
    print(json.dumps(run(args.url,args.video,args.key_env,args.upload_field),indent=2))
