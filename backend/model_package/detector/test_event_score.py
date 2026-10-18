import unittest
from event_score import matches


class EventMatchingChecks(unittest.TestCase):
    def label(self,a,b,rid='door_open'):return {'rule_id':rid,'start_sec':str(a),'end_sec':str(b)}

    def test_wrong_type_cannot_count_as_event_match(self):
        self.assertEqual(matches([{'rule_id':'visitor_inside','timecode_sec':6}],[self.label(5,10)]),0)

    def test_duplicate_predictions_cannot_match_one_label_twice(self):
        events=[{'rule_id':'door_open','timecode_sec':6} for _ in range(3)]
        self.assertEqual(matches(events,[self.label(5,10)]),1)

    def test_matching_uses_maximum_one_to_one_assignment(self):
        events=[{'rule_id':'door_open','timecode_sec':5},{'rule_id':'door_open','timecode_sec':2}]
        self.assertEqual(matches(events,[self.label(0,6),self.label(4,10)]),2)

    def test_tolerance_is_explicit(self):
        events=[{'rule_id':'door_open','timecode_sec':4.5}]
        self.assertEqual(matches(events,[self.label(5,10)]),0)
        self.assertEqual(matches(events,[self.label(5,10)],tolerance=2),1)


if __name__=='__main__':unittest.main()
