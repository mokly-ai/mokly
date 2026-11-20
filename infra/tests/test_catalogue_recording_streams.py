"""Raw stream checks separate only operation-specific values."""

import unittest

import support
from catalogue_recording_streams import recording_matches


def stdout(root, cache="a", result=b"Published Mokly catalogue. 18 files uploaded, 0 unchanged.\n"):
    return (f"Mokly publish build: {root}/tmp/mokly-publish-Abc123/site\n"
            f"Mokly cache: {root}/cache/mokly/{cache * 64}\n").encode() + result


TIMING = b'[mokly:timing] {"schemaVersion":1,"session":"publish-123","pid":123,"role":"core","stage":"publish","id":1,"event":"start","elapsedMs":0}\n'


class RecordingStreamTests(unittest.TestCase):
    def test_private_paths_vary_but_result_bytes_and_path_structure_stay_checked(self):
        recorded = stdout("/recorded", "a")
        actual = stdout("/fresh", "b")
        for case in ["success", "invalid-bundle", "too-large"]:
            name = f"mokly-publish-{case}.stdout.txt"
            with self.subTest(case=case):
                self.assertTrue(recording_matches(name, actual, recorded))
                for changed in [actual.replace(b"18 files", b"19 files"),
                                actual.replace(b"/fresh/cache", b"/another/cache"),
                                actual.replace(b"/site\n", b"/other\n"),
                                actual + b"unexpected output\n"]:
                    self.assertFalse(recording_matches(name, changed, recorded))

    def test_timing_identity_and_clock_vary_but_other_json_bytes_stay_exact(self):
        name = "mokly-publish-timings.stderr.txt"
        actual = TIMING.replace(b"123", b"456").replace(b'"elapsedMs":0', b'"elapsedMs":0.25')
        self.assertTrue(recording_matches(name, actual, TIMING))
        for changed in [actual.replace(b'"core"', b'"sidecar"'),
                        actual.replace(b'"id":1', b'"id":2'),
                        actual.replace(b'"pid":456', b'"pid":"456"'),
                        actual.replace(b'"pid":456', b'"pid": 456'),
                        actual.rstrip(b"\n")]:
            with self.subTest(changed=changed):
                self.assertFalse(recording_matches(name, changed, TIMING))

    def test_refusal_streams_and_exit_statuses_remain_byte_exact(self):
        for name, data in [("mokly-publish-git-uncommitted.stdout.txt", b""),
                           ("mokly-publish-git-uncommitted.stderr.txt", b"refusal\n"),
                           ("mokly-publish-success.exit.txt", b"0\n")]:
            with self.subTest(name=name):
                self.assertTrue(recording_matches(name, data, data))
                self.assertFalse(recording_matches(name, data + b"changed\n", data))


if __name__ == "__main__":
    unittest.main()
