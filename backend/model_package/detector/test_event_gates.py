"""Required-condition checks, never recognition accuracy tests."""
import unittest
from unittest.mock import patch
import event_gates as e
import general_pipeline as g
from test_general import GeneralChecks
from pipeline import AnalysisError


class GateChecks(unittest.TestCase):
    def answer(self,ids):
        return {'conditions':{key:'yes' for rid in ids for key in e.REQUIREMENTS[rid]},'before_index':0,'after_index':2,'evidence_index':2}

    def test_normal_alternative_blocks_claim(self):
        answer=self.answer(['two_clients'])
        answer['conditions']['second_transaction_started']='no'
        self.assertEqual(e.accepted(answer,['two_clients'],[0,1,2]),[])

    def test_unknown_role_blocks_visitor_but_not_supported_door(self):
        ids=['door_open','visitor_inside'];answer=self.answer(ids)
        answer['conditions']['customer_role_established']='unknown'
        self.assertEqual(e.accepted(answer,ids,[0,1,2]),['door_open'])

    def test_temporal_claim_cannot_use_same_moment_twice(self):
        answer=self.answer(['safe_open']);answer['after_index']=0
        self.assertEqual(e.accepted(answer,['safe_open'],[0,1,2]),[])
        answer=self.answer(['drink_cash']);answer['after_index']=0
        self.assertEqual(e.accepted(answer,['drink_cash'],[0,1,2]),['drink_cash'])

    def test_missing_fact_is_an_error(self):
        answer=self.answer(['safe_open']);del answer['conditions']['safe_open']
        with self.assertRaises(AnalysisError):e.accepted(answer,['safe_open'],[0,1,2])

    def test_access_family_can_recover_door_hypothesis(self):
        rules={'door_open':{'mode':'detect'},'visitor_inside':{'mode':'detect'}}
        self.assertEqual(e.checked_ids('visitor_inside',rules),['door_open','visitor_inside'])

    def test_later_context_is_included_without_labelled_timestamp(self):
        item={'rule_id':'visitor_inside','timestamp_sec':3.5,'source_times_sec':[0,2,3.5,5]}
        with patch.object(g,'frame_at',side_effect=lambda cap,t,fps,**kw:{'timestamp_sec':t}):
            views,images,static=g.gate_views(None,30,21,item)
        self.assertEqual([f['timestamp_sec'] for f in views],[0,3.5,5.5,7.5,11.5])
        self.assertFalse(static)
        self.assertEqual(len(images),5)
        answer=self.answer(['door_open']);answer['after_index']=4;answer['evidence_index']=4
        self.assertEqual(e.accepted(answer,['door_open'],[0,3.5,5.5,7.5,11.5]),['door_open'])

    def test_static_detail_covers_both_halves_at_same_instant(self):
        calls=[]
        def frame(cap,t,fps,**kw):
            calls.append((t,kw));return {'timestamp_sec':t}
        item={'rule_id':'drink_cash','timestamp_sec':14,'source_times_sec':[10,12,14,15]}
        with patch.object(g,'frame_at',side_effect=frame):
            views,images,static=g.gate_views(None,30,19,item)
        self.assertTrue(static)
        self.assertEqual([v['timestamp_sec'] for v in views],[14,14,14])
        self.assertEqual(len(images),3)
        self.assertEqual(calls[1][1]['roi'],[0,0,1,.6])
        self.assertEqual(calls[2][1]['roi'],[0,.4,1,1])


class GateEndToEnd(GeneralChecks):
    # Reuse the synthetic fixture; inherited general tests still cover ungated mode.
    def test_direct_proposal_is_held_until_all_required_facts_pass(self):
        for status,expected in [('unknown','no_violation'),('yes','violation')]:
            def fake(prompt,frames,deadline,schema):
                if 'observations' in schema['properties']:
                    return {'scene_summary':'Synthetic test.','observations':[{'rule_id':'drink_cash','support':'visible','evidence_index':1,'region':'lower_left','observation':'Synthetic proposal.'}]}
                keys=schema['properties']['conditions']['required']
                return {'conditions':{key:status for key in keys},'before_index':0,'after_index':2,'evidence_index':1}
            with patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),patch.object(g,'query',side_effect=fake):
                result=g.analyze_video(self.video,fact_gates=True)
            self.assertEqual(result['verdict'],expected)
            self.assertEqual(result['analysis']['fact_gate_calls'],1)
