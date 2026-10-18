import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import full_pass as fp
from full_pass import reusable,save,ROOT


class ResumeChecks(unittest.TestCase):
    def test_resume_requires_matching_code_video_and_revision(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            path=Path(folder)/'video.json'
            result={'verdict':'no_violation','violations':[],'analysis':{'status':'done','duration_sec':10,'runtime_sec':1,'windows_scanned':1,'windows_total':1,
                    'full_pass_fingerprint':'code','source_sha256':'video','focused_revision':'v06'}}
            save(path,result)
            self.assertIsNotNone(reusable(path,'code','video','v06'))
            self.assertIsNone(reusable(path,'other','video','v06'))
            self.assertIsNone(reusable(path,'code','other','v06'))
            self.assertIsNone(reusable(path,'code','video','v05'))
            result['analysis']['status']='failed';save(path,result)
            self.assertIsNone(reusable(path,'code','video','v06'))

    def test_complete_synthetic_pass_resumes_without_repeating_inference(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            root=Path(folder);out=root/'results';available={}
            for key in fp.DEBUG:
                available[key]=root/(key+'.mov');available[key].write_bytes(b'Synthetic fixture, not footage.')
            (root/'labels.csv').write_text('video,verdict,start_sec,end_sec,rule_id\n'+''.join(k+',no_violation,,,\n' for k in fp.DEBUG),encoding='utf-8')
            (root/'rules.json').write_text('{"rules":[]}',encoding='utf-8')
            def result(*args,**kwargs):
                return {'verdict':'no_violation','violations':[],'analysis':{'status':'done','duration_sec':10,'runtime_sec':1,'windows_scanned':1,'windows_total':1,'review_flags':[]}}
            def render(result,path):Path(path).write_text('Synthetic review',encoding='utf-8')
            with patch.object(fp,'ROOT',root),patch.object(fp,'BASELINE',root/'missing'),patch.object(fp,'fingerprint',return_value='fixed'),patch.object(fp,'api',return_value={'models':[{'name':'qwen3.5:4b'}]}),patch.object(fp,'training_status',return_value=[]),patch.object(fp,'ordered_ids',return_value=(fp.DEBUG,available,{k:10 for k in fp.DEBUG})),patch.object(fp,'render_report',side_effect=render),patch.object(fp,'run_job',side_effect=result) as jobs,patch('builtins.print'):
                fp.run(root,out)
                self.assertEqual(jobs.call_count,4)
                fp.run(root,out)
                self.assertEqual(jobs.call_count,4)
            self.assertEqual(json.loads((out/'selected'/'scores.json').read_text())['summary']['correct'],4)


if __name__=='__main__':unittest.main()
