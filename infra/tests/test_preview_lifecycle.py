"""Provider reconciliation and namespace-secret contracts for PR previews."""

import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

from support import ROOT, load

cloud = load("preview_lifecycle_cloud")
core = load("preview_lifecycle_core")
gcp = load("preview_lifecycle_gcp")
lifecycle = load("preview-lifecycle")

FIXTURES = ROOT / "infra/tests/fixtures/preview-lifecycle"


class Response:
    def __init__(self, body, status=200):
        self.body = body
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_arguments):
        return False

    def read(self):
        return self.body


class RecordedCloudflare:
    def __init__(self, *names):
        self.responses = [(FIXTURES / name).read_bytes() for name in names]
        self.calls = []

    def __call__(self, request, timeout):
        self.calls.append((request, timeout))
        return Response(self.responses.pop(0))


def variables():
    return {
        "MKC_CATALOGUE_CLOUDFLARE_ZONE_ID": "a" * 32,
        "MKC_CATALOGUE_BASE_DOMAIN": "catalogues.net",
        "MKC_PREVIEW_INGRESS_IP": "192.0.2.42",
        "MKC_PREVIEW_BLOBS_BUCKET": "mokly-508518-preview-blobs",
    }


class CloudflareTests(unittest.TestCase):
    def token(self, directory):
        path = Path(directory) / "token"
        path.write_text("fixture-token\n")
        return path

    def test_create_paginates_and_uses_the_result_id(self):
        with tempfile.TemporaryDirectory() as directory:
            opener = RecordedCloudflare(
                "cloudflare-list-page-1.json",
                "cloudflare-list-page-2-empty.json",
                "cloudflare-create.json",
            )
            identifier = cloud.upsert_dns(
                "preview-pr-42", self.token(directory), variables(), opener
            )
        self.assertEqual(identifier, "0123456789abcdef0123456789abcdef")
        self.assertEqual([call[0].method for call in opener.calls], ["GET", "GET", "POST"])
        self.assertIn("page=1", opener.calls[0][0].full_url)
        self.assertIn("page=2", opener.calls[1][0].full_url)
        body = json.loads(opener.calls[2][0].data)
        self.assertEqual(body, {
            "type": "A", "name": "*.pr-42.preview.catalogues.net",
            "content": "192.0.2.42", "proxied": False, "ttl": 300,
            "comment": "mokly-preview:preview-pr-42",
        })
        self.assertEqual(opener.calls[2][1], 10)
        self.assertEqual(opener.calls[2][0].headers["Authorization"], "Bearer fixture-token")

    def test_owned_record_updates_then_an_exact_rerun_is_read_only(self):
        with tempfile.TemporaryDirectory() as directory:
            token = self.token(directory)
            update = RecordedCloudflare(
                "cloudflare-list-page-1.json", "cloudflare-list-page-2-owned.json",
                "cloudflare-update.json",
            )
            cloud.upsert_dns("preview-pr-42", token, variables(), update)
            ready = RecordedCloudflare(
                "cloudflare-list-page-1.json", "cloudflare-list-page-2-ready.json"
            )
            cloud.upsert_dns("preview-pr-42", token, variables(), ready)
        self.assertEqual(update.calls[2][0].method, "PUT")
        self.assertTrue(update.calls[2][0].full_url.endswith("/0123456789abcdef0123456789abcdef"))
        self.assertEqual(len(ready.calls), 2)

    def test_unowned_duplicates_and_success_false_are_failures(self):
        with tempfile.TemporaryDirectory() as directory:
            token = self.token(directory)
            unowned = RecordedCloudflare(
                "cloudflare-list-page-1.json", "cloudflare-list-page-2-unowned.json"
            )
            with self.assertRaisesRegex(ValueError, "not owned"):
                cloud.upsert_dns("preview-pr-42", token, variables(), unowned)
            duplicate = json.loads((FIXTURES / "cloudflare-list-page-2-owned.json").read_text())
            second = dict(duplicate["result"][0], id="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
            duplicate["result"].append(second)
            sequence = RecordedCloudflare("cloudflare-list-page-1.json")
            sequence.responses.append(json.dumps(duplicate).encode())
            with self.assertRaisesRegex(ValueError, "multiple Cloudflare"):
                cloud.upsert_dns("preview-pr-42", token, variables(), sequence)
            failed = RecordedCloudflare("cloudflare-success-false.json")
            with self.assertRaisesRegex(ValueError, "9109.*Invalid access token"):
                cloud.upsert_dns("preview-pr-42", token, variables(), failed)

    def test_destroy_deletes_only_the_marked_a_record(self):
        with tempfile.TemporaryDirectory() as directory:
            opener = RecordedCloudflare(
                "cloudflare-list-page-1.json", "cloudflare-list-page-2-ready.json",
                "cloudflare-delete.json",
            )
            result = cloud.delete_dns(
                "preview-pr-42", self.token(directory), variables(), opener
            )
        self.assertEqual(result, "0123456789abcdef0123456789abcdef")
        self.assertEqual(opener.calls[-1][0].method, "DELETE")


class IamTests(unittest.TestCase):
    def test_policy_upsert_retries_one_etag_conflict_and_preserves_bindings(self):
        initial = (FIXTURES / "gcloud-iam-get.json").read_text()
        conflict = core.CommandFailure(
            ["gcloud", "storage", "buckets", "set-iam-policy"], 1, "",
            (FIXTURES / "gcloud-iam-conflict.stderr.txt").read_text(),
        )
        policies = []
        gets = 0

        def command(arguments, stdin=None):
            nonlocal gets
            if arguments[1:3] == ["projects", "describe"]:
                return (FIXTURES / "gcloud-project-describe.stdout.txt").read_text()
            if "get-iam-policy" in arguments:
                gets += 1
                value = json.loads(initial)
                value["etag"] = f"etag-{gets}"
                return json.dumps(value)
            if "set-iam-policy" in arguments:
                policies.append(json.loads(Path(arguments[5]).read_text()))
                if len(policies) == 1:
                    raise conflict
                return (FIXTURES / "gcloud-iam-set.json").read_text()
            self.fail(arguments)

        sleeps = []
        with patch.object(gcp, "run_command", side_effect=command):
            changed = gcp.change_iam("preview-pr-42", True, variables(), sleeps.append)
        self.assertTrue(changed)
        self.assertEqual(sleeps, [1])
        self.assertEqual(len(policies), 2)
        policy = policies[-1]
        self.assertEqual(policy["version"], 3)
        self.assertIn("serviceAccount:foundation@example.iam.gserviceaccount.com", policy["bindings"][0]["members"])
        conditions = [binding for binding in policy["bindings"] if "condition" in binding]
        self.assertEqual({binding["role"] for binding in conditions}, {
            "roles/storage.objectUser", "roles/storage.objectViewer",
        })
        for binding in conditions:
            self.assertEqual(binding["condition"]["title"], "mkc-preview-pr-42")
            self.assertTrue(binding["condition"]["expression"].endswith("/objects/pr-42/')"))

    def test_exact_removal_preserves_unrelated_members(self):
        tuples = gcp.iam_tuples("preview-pr-42", "123456789012", gcp.BUCKET)
        role, member, condition = tuples[0]
        policy = {"version": 3, "bindings": [{
            "role": role, "members": [member, "principal://unrelated"],
            "condition": condition,
        }]}
        self.assertTrue(gcp.change_bindings(policy, tuples, False))
        self.assertEqual(policy["bindings"], [{
            "role": role, "members": ["principal://unrelated"], "condition": condition,
        }])

    def test_policy_is_promoted_to_version_three_even_when_members_match(self):
        tuples = gcp.iam_tuples("preview-pr-42", "123456789012", gcp.BUCKET)
        role, member, condition = tuples[0]
        policy = {"version": 1, "bindings": [{
            "role": role, "members": [member], "condition": condition,
        }]}
        self.assertTrue(gcp.change_bindings(policy, (tuples[0],), True))
        self.assertEqual(policy["version"], 3)

    def test_etag_conflicts_stop_after_five_set_attempts(self):
        initial = (FIXTURES / "gcloud-iam-get.json").read_text()
        conflict = core.CommandFailure(
            ["gcloud", "storage", "buckets", "set-iam-policy"], 1, "",
            (FIXTURES / "gcloud-iam-conflict.stderr.txt").read_text(),
        )
        sets = 0

        def command(arguments, stdin=None):
            nonlocal sets
            if arguments[1:3] == ["projects", "describe"]:
                return "123456789012\n"
            if "get-iam-policy" in arguments:
                return initial
            if "set-iam-policy" in arguments:
                sets += 1
                raise conflict
            self.fail(arguments)

        sleeps = []
        with patch.object(gcp, "run_command", side_effect=command):
            with self.assertRaises(core.CommandFailure):
                gcp.change_iam("preview-pr-42", True, variables(), sleeps.append)
        self.assertEqual(sets, 5)
        self.assertEqual(sleeps, [1, 2, 4, 8])


class ObjectAndSecretTests(unittest.TestCase):
    def test_only_the_exact_no_objects_diagnostic_counts_as_absence(self):
        diagnostic = (FIXTURES / "gcloud-storage-no-objects.stderr.txt").read_text()
        arguments = ["gcloud", "storage", "ls"]
        self.assertTrue(gcp.missing_objects(core.CommandFailure(arguments, 1, "", diagnostic)))
        for extra in ("Unexpected error\n" + diagnostic, diagnostic + "Unexpected error\n"):
            with self.subTest(extra=extra):
                self.assertFalse(gcp.missing_objects(core.CommandFailure(arguments, 1, "", extra)))
        batch = [
            "gs://mokly-508518-preview-blobs/pr-42/sha256/aa/first#1790194920102844",
            "gs://mokly-508518-preview-blobs/pr-42/sha256/bb/second#1790180600109778",
        ]
        removal = ["gcloud", "storage", "rm", "--read-paths-from-stdin", "--project=mokly-508518", "--quiet"]
        missing = (FIXTURES / "gcloud-storage-rm-missing.stderr.txt").read_text()
        self.assertEqual((FIXTURES / "gcloud-storage-rm-missing.exit.txt").read_text().strip(), "1")
        self.assertEqual(gcp.missing_removals(core.CommandFailure(removal, 1, "", missing), batch), [batch[1]])
        self.assertIsNone(gcp.missing_removals(core.CommandFailure(removal, 1, "", missing + "Unexpected error\n"), batch))
        self.assertIsNone(gcp.missing_removals(core.CommandFailure(removal, 1, "", missing.replace("bb/second", "cc/third")), batch))
        self.assertIsNone(gcp.missing_removals(core.CommandFailure(removal, 1, "", missing.replace("Removing objects:", "WARNING: slow")), batch))
        self.assertIsNone(gcp.missing_removals(core.CommandFailure(removal, 2, "", missing), batch))

    def test_object_cleanup_uses_recorded_listing_and_final_no_match(self):
        listing = (FIXTURES / "gcloud-storage-list.json").read_text()
        calls = []
        listed = 0

        def command(arguments, stdin=None):
            nonlocal listed
            calls.append(arguments)
            if arguments[1:3] == ["storage", "ls"]:
                listed += 1
                if listed == 1:
                    return listing
                raise core.CommandFailure(
                    arguments, 1, "", (FIXTURES / "gcloud-storage-no-objects.stderr.txt").read_text()
                )
            if arguments[1:4] == ["storage", "rm", "--read-paths-from-stdin"]:
                removed.append(stdin)
                return (FIXTURES / "gcloud-storage-rm.stdout.txt").read_text()
            self.fail(arguments)

        removed = []
        with patch.object(gcp, "run_command", side_effect=command):
            gcp.delete_objects("preview-pr-42", variables())
        self.assertEqual(len(removed), 1, "one CLI call removes the whole listing")
        urls = removed[0].splitlines()
        self.assertEqual(len(urls), 2)
        self.assertTrue(all(url.startswith("gs://mokly-508518-preview-blobs/pr-42/") and "#" in url for url in urls))
        self.assertEqual((FIXTURES / "gcloud-storage-rm.exit.txt").read_text().strip(), "0")
        self.assertEqual((FIXTURES / "gcloud-storage-rm.stdout.txt").read_text(), "", "the CLI reports progress on stderr")

    def test_object_cleanup_retries_a_batch_without_the_vanished_urls(self):
        listing = (FIXTURES / "gcloud-storage-list.json").read_text()
        missing = (FIXTURES / "gcloud-storage-rm-missing.stderr.txt").read_text()
        removed = []
        listed = 0

        def command(arguments, stdin=None):
            nonlocal listed
            if arguments[1:3] == ["storage", "ls"]:
                listed += 1
                if listed == 1:
                    return listing
                raise core.CommandFailure(
                    arguments, 1, "", (FIXTURES / "gcloud-storage-no-objects.stderr.txt").read_text()
                )
            removed.append(stdin)
            if len(removed) == 1:
                raise core.CommandFailure(arguments, 1, "", missing)
            return ""

        with patch.object(gcp, "run_command", side_effect=command):
            gcp.delete_objects("preview-pr-42", variables())
        self.assertEqual(len(removed), 2)
        self.assertEqual(removed[1], "gs://mokly-508518-preview-blobs/pr-42/sha256/aa/first#1790194920102844\n")

    def test_object_cleanup_batches_large_listings_and_keeps_real_failures(self):
        entry = json.loads((FIXTURES / "gcloud-storage-list.json").read_text())[0]
        entries = []
        for index in range(450):
            item = json.loads(json.dumps(entry))
            item["url"] = f"gs://mokly-508518-preview-blobs/pr-42/sha256/{index:03d}/blob#{index}"
            item["metadata"]["name"] = f"pr-42/sha256/{index:03d}/blob"
            entries.append(item)
        removed = []
        listed = 0

        def command(arguments, stdin=None):
            nonlocal listed
            if arguments[1:3] == ["storage", "ls"]:
                listed += 1
                return json.dumps(entries if listed == 1 else entries[:1])
            removed.append(stdin)
            if len(removed) == 2:
                raise core.CommandFailure(arguments, 1, "", "ERROR: (gcloud.storage.rm) HTTPError 403: forbidden\n")
            return ""

        with patch.object(gcp, "run_command", side_effect=command), self.assertRaisesRegex(ValueError, "403.*1 live preview objects remain"):
            gcp.delete_objects("preview-pr-42", variables())
        self.assertEqual([len(batch.splitlines()) for batch in removed], [200, 200, 50])

    def test_object_listing_rejects_foreign_entries_inside_the_array(self):
        listing = json.loads((FIXTURES / "gcloud-storage-list.json").read_text())
        self.assertIsInstance(listing, list, "the CLI answers with one JSON array")
        bucket_entry = {"url": "gs://mokly-508518-preview-blobs/", "type": "cloud_bucket", "metadata": {}}
        escaped = json.loads(json.dumps(listing[0]))
        escaped["url"] = "gs://mokly-508518-preview-blobs/pr-43/sha256/aa/first#1"
        escaped["metadata"]["name"] = "pr-43/sha256/aa/first"
        for entries, message in ((listing + [bucket_entry], "non-object"), (listing + [escaped], "escaped")):
            with self.subTest(message=message), patch.object(gcp, "run_command", return_value=json.dumps(entries)):
                with self.assertRaisesRegex(ValueError, message):
                    gcp.list_objects("mokly-508518-preview-blobs", "pr-42")
        with patch.object(gcp, "run_command", return_value=json.dumps(listing)):
            self.assertEqual(len(gcp.list_objects("mokly-508518-preview-blobs", "pr-42")), 2)

    def test_recorded_secrets_validate_and_mismatched_url_fails(self):
        for command, fixture in (
            (lifecycle.validate_postgres_secret, "kubectl-postgres-secret.json"),
            (lifecycle.validate_signing_secret, "kubectl-signing-secret.json"),
            (lifecycle.validate_preview_secret, "kubectl-preview-secret.json"),
        ):
            with self.subTest(fixture=fixture), patch("sys.stdin", io.StringIO((FIXTURES / fixture).read_text())):
                command()
        value = json.loads((FIXTURES / "kubectl-postgres-secret.json").read_text())
        value["data"]["url"] = value["data"]["password"]
        with patch("sys.stdin", io.StringIO(json.dumps(value))), self.assertRaisesRegex(ValueError, "URL"):
            lifecycle.validate_postgres_secret()

    def test_preview_secret_extract_is_private_and_exact(self):
        fixture = (FIXTURES / "kubectl-preview-secret.json").read_text()
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "preview-sign-in"
            with patch("sys.stdin", io.StringIO(fixture)):
                lifecycle.extract_preview(destination)
            value = destination.read_text()
            mode = stat.S_IMODE(destination.stat().st_mode)
        self.assertEqual(value, "c" * 64)
        self.assertEqual(mode, 0o600)


if __name__ == "__main__":
    unittest.main()
