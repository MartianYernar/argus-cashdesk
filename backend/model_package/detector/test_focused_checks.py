"""Synthetic/mocked integrity checks, not bank-video accuracy measurements."""
import unittest
from unittest.mock import patch
import focused_checks as f
import general_pipeline as g
from pipeline import AnalysisError
from test_general import GeneralChecks


class FocusedChecks(unittest.TestCase):
    def item(self,rid='drink_cash',stamp=10,support='unclear'):
        return {'rule_id':rid,'timestamp_sec':stamp,'source_times_sec':[stamp-2,stamp-1,stamp,stamp+1],
                'support':support,'region':'whole','observation':'Synthetic.'}

    def test_group_keeps_later_visible_evidence_and_whole_interval(self):
        rules={'drink_cash':{'mode':'detect'}}
        early=self.item();late=self.item(stamp=14,support='visible')
        grouped=f.group_candidates([late,early],rules)
        self.assertEqual(len(grouped),1)
        self.assertEqual(grouped[0]['timestamp_sec'],14)
        self.assertEqual(grouped[0]['support'],'visible')
        self.assertEqual(grouped[0]['source_times_sec'],[8,9,10,11,12,13,14,15])
        self.assertEqual(grouped[0]['proposal_times'],[10,14])
        self.assertNotIn('_anchor',early)

    def test_group_does_not_chain_short_events_across_entire_video(self):
        grouped=f.group_candidates([self.item(stamp=t) for t in [0,7,14]],{'drink_cash':{'mode':'detect'}})
        self.assertEqual(len(grouped),2)

    def test_many_early_proposals_cannot_displace_later_rescue_instants(self):
        item=self.item(stamp=10);item['proposal_times']=[3,4,5,6,10]
        self.assertEqual(f.static_times(item,20)[:3],[10,12,14])

    def test_static_failed_instant_does_not_veto_later_supported_one(self):
        calls=[]
        def ask(prompt,images,schema,phase):
            calls.append(images[0]['timestamp_sec'])
            status='yes' if len(calls)==2 else 'no'
            return {key:status for key in schema['required']}
        with patch.object(f,'frame_at',side_effect=lambda cap,t,fps,**kw:{'timestamp_sec':t,'image_base64':'synthetic'}):
            events=f.verify_static(self.item(),None,30,20,ask)
        self.assertEqual(calls,[10,12,11])
        self.assertEqual(events[0][1][0]['timestamp_sec'],12)

    def test_box_validation_never_turns_unknown_or_tiny_box_into_a_detection(self):
        self.assertIsNone(f.valid_box({'found':'unclear'}))
        self.assertIsNone(f.valid_box({'found':'yes','x0':10,'y0':10,'x1':11,'y1':11}))
        with self.assertRaises(AnalysisError):f.valid_box({'found':'yes','x0':900,'y0':0,'x1':1200,'y1':500})
        self.assertEqual(f.valid_box({'found':'yes','x0':100,'y0':200,'x1':500,'y1':800}),[.1,.2,.5,.8])

    def test_compact_scan_excludes_review_only_types(self):
        rules={'drink_cash':{'mode':'detect','criteria':'Drink beside notes.'},'id_not_seen':{'mode':'review_only','criteria':'Not provable.'}}
        ids=f.scan_schema(rules)['properties']['events']['items']['properties']['rule_id']['enum']
        self.assertEqual(ids,['drink_cash'])
        with self.assertRaises(AnalysisError):f.parse_scan({'events':[{'rule_id':'id_not_seen'}]},rules)

    def test_wrong_role_does_not_become_customer_intrusion(self):
        def ask(prompt,images,schema,phase):
            if phase=='object_localization':return {'found':'yes','x0':100,'y0':100,'x1':900,'y1':900}
            return {'door_before':'open','door_middle':'closed','door_after':'closed','doorway_middle':'clear',
                    'doorway_after':'clear','passage':'unidentified','crossing_direction':'into_work_area','customer_transaction_before_crossing':'no','object_identity':'access_door'}
        with patch.object(f,'frame_at',side_effect=lambda cap,t,fps,**kw:{'timestamp_sec':t}):
            self.assertEqual(f.verify_door(self.item('visitor_inside'),None,30,20,ask),[])


class FocusedIntegration(GeneralChecks):
    def test_focused_mode_preserves_actual_confirming_timestamp(self):
        checks=[]
        def fake(prompt,frames,deadline,schema):
            if 'events' in schema['properties']:
                return {'events':[{'rule_id':'drink_cash','support':'visible','evidence_index':0}]}
            checks.append(frames[0]['timestamp_sec'])
            return {key:('yes' if len(checks)==2 else 'no') for key in schema['required']}
        with patch.object(g,'api',return_value={'models':[{'name':g.MODEL}]}),patch.object(g,'query',side_effect=fake):
            result=g.analyze_video(self.video,focused_checks=True)
        self.assertEqual(result['verdict'],'violation')
        self.assertEqual(result['violations'][0]['timecode_sec'],2)
        self.assertEqual(result['analysis']['fact_gate_calls'],3)
        self.assertEqual(result['analysis']['model_call_count'],4)

    def test_uncertain_localization_requires_object_confirmation_before_claim(self):
        for identity,expected in [('other',0),('access_door',1)]:
            phases=[]
            def ask(prompt,images,schema,phase):
                phases.append(phase)
                if phase=='object_localization':return {'found':'unclear','x0':100,'y0':100,'x1':900,'y1':900}
                return {'door_before':'closed','door_middle':'open','door_after':'open',
                    'doorway_middle':'clear','doorway_after':'clear','passage':'cashier',
                    'crossing_direction':'out_of_work_area','customer_transaction_before_crossing':'no','object_identity':identity}
            item={'rule_id':'door_open','timestamp_sec':1,'source_times_sec':[0,1,2]}
            with patch.object(f,'frame_at',side_effect=lambda cap,t,fps,**kw:{'timestamp_sec':t}):
                events=f.verify_door(item,None,30,10,ask)
            self.assertEqual(phases,['object_localization','localized_states'])
            self.assertEqual(len(events),expected)

    def test_server_metrics_are_kept_without_exposing_model_response(self):
        response={'message':{'content':'{"x":"yes"}'},'prompt_eval_count':123,'eval_count':8,'eval_duration':1000,'secret':'ignored'}
        with patch.object(g,'api',return_value=response):
            answer=g.query('Synthetic.',[],float('inf'),{'type':'object'})
        self.assertEqual(answer,{'x':'yes'})
        self.assertEqual(answer.server_stats['eval_count'],8)
        self.assertNotIn('secret',answer.server_stats)


if __name__=='__main__':unittest.main()
