"""The capture receiver answers plan v1 and stores only verified blobs."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import http.client
import io
import json
import gzip
from pathlib import Path
import re
import socket
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

import support
import catalogue_capture_state
from catalogue_capture_endpoint import CaptureEndpoint, EndpointError
from catalogue_capture_support import ENVELOPE, INDEX, MARKER, marker_bytes


TOKEN = "a" * 64
EXPIRES_AT = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z")


def export_files(pages=2):
    """A finalized export whose page hashes are all distinct."""
    envelope = {"schemaVersion": 3}
    files = {ENVELOPE: json.dumps(envelope).encode(), INDEX: json.dumps({"schemaVersion": 9}).encode()}
    for index in range(pages):
        files[f"view/page-{index}/index.html"] = f"<main>{index}</main>".encode()
    return files


def plan_archive(files, marker=None, extra=()):
    """Pack the plan archive the CLI sends: envelope, marker, then index."""
    buffer = io.BytesIO()
    members = [
        (ENVELOPE, files[ENVELOPE]),
        (MARKER, marker if marker is not None else marker_bytes(files)),
        (INDEX, files[INDEX]),
        *extra,
    ]
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name, data in members:
            item = tarfile.TarInfo(name)
            item.size = len(data)
            archive.addfile(item, io.BytesIO(data))
    return buffer.getvalue()


def digest(data):
    return hashlib.sha256(data).hexdigest()


class Receiver:
    """One running receiver in a temporary directory, driven by direct requests."""

    def __init__(self, advertise_gzip=False):
        self.advertise_gzip = advertise_gzip

    def __enter__(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        self.endpoint = CaptureEndpoint(
            self.directory, TOKEN, advertise_gzip=self.advertise_gzip
        )
        self.url = self.endpoint.__enter__()
        return self

    def __exit__(self, *details):
        self.endpoint.__exit__(*details)
        self.temporary.cleanup()

    def send(
        self,
        method,
        url,
        body=None,
        content_type=None,
        content_encoding=None,
        token=TOKEN,
    ):
        parsed = urlsplit(url)
        headers = {"Authorization": "Bearer " + token}
        if content_type is not None:
            headers["Content-Type"] = content_type
        if content_encoding is not None:
            headers["Content-Encoding"] = content_encoding
        connection = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=10)
        try:
            connection.request(method, parsed.path, body=body, headers=headers)
            response = connection.getresponse()
            return response.status, response.getheader("Content-Type"), response.read()
        finally:
            connection.close()

    def plan(self, files):
        status, content_type, body = self.send(
            "POST", self.url, plan_archive(files), "application/gzip"
        )
        return status, content_type, json.loads(body) if status == 200 else None

    def put(
        self,
        plan,
        data,
        content_type="application/octet-stream",
        content_encoding=None,
        digest_value=None,
    ):
        url = plan["blobUrl"].replace("{sha256}", digest_value or digest(data))
        return self.send(
            "PUT", url, data, content_type, content_encoding=content_encoding
        )[0]


class CaptureReceiverTests(unittest.TestCase):
    def test_plan_matches_the_released_plan_v1_contract(self):
        files = export_files()
        files["view/copy/index.html"] = files["view/page-0/index.html"]
        with Receiver() as receiver, patch.object(catalogue_capture_state, "datetime") as clock:
            clock.now.return_value = datetime(2000, 1, 1, tzinfo=timezone.utc)
            status, content_type, plan = receiver.plan(files)
        self.assertEqual((status, content_type), (200, "application/json"))
        self.assertEqual(set(plan), {"schemaVersion", "upload", "missing", "blobUrl", "completeUrl"})
        self.assertIs(type(plan["schemaVersion"]), int)
        self.assertEqual(plan["schemaVersion"], 1)
        upload = plan["upload"]
        self.assertRegex(upload["id"], r"^[a-f0-9]{32}$")
        self.assertRegex(upload["expiresAt"], EXPIRES_AT)
        self.assertEqual(upload["expiresAt"], "2000-01-01T01:00:00.000Z")
        pages = [files["view/page-0/index.html"], files["view/page-1/index.html"]]
        self.assertEqual(plan["missing"], sorted(digest(page) for page in pages))
        base = receiver.url.rstrip("/") + "/uploads/" + upload["id"]
        self.assertEqual(plan["blobUrl"], base + "/blobs/{sha256}")
        self.assertEqual(plan["completeUrl"], base + "/complete")

    def test_gzip_plan_advertisement_and_blob_storage(self):
        files = export_files()
        files["view/page-0/index.html"] = b"x" * 64
        with Receiver(advertise_gzip=True) as receiver:
            _status, _content_type, plan = receiver.plan(files)
            self.assertEqual(plan["blobEncodings"], ["gzip"])
            first = files["view/page-0/index.html"]
            second = files["view/page-1/index.html"]
            self.assertEqual(
                receiver.put(plan, gzip.compress(first), content_encoding="gzip", digest_value=digest(first)),
                204,
            )
            self.assertEqual(receiver.put(plan, second), 204)
            self.assertEqual(receiver.send("POST", plan["completeUrl"])[0], 201)
            receiver.endpoint.require_exchange()
            self.assertEqual(
                (receiver.directory / "blobs" / digest(first)).read_bytes(), first
            )

    def test_invalid_gzip_stores_no_partial_blob(self):
        files = export_files()
        files["view/page-0/index.html"] = b"x" * 64
        with Receiver(advertise_gzip=True) as receiver:
            _status, _content_type, plan = receiver.plan(files)
            expected = files["view/page-0/index.html"]
            status = receiver.put(
                plan,
                b"not gzip",
                content_encoding="gzip",
                digest_value=digest(expected),
            )
            self.assertEqual(status, 400)
            self.assertEqual(list((receiver.directory / "blobs").iterdir()), [])

    def test_concurrent_blobs_and_repeated_completion_finish_one_exchange(self):
        files = export_files(pages=24)
        pages = [data for name, data in files.items() if name.startswith("view/")]
        with Receiver() as receiver:
            _status, _type, plan = receiver.plan(files)
            with ThreadPoolExecutor(max_workers=8) as pool:
                statuses = list(pool.map(lambda page: receiver.put(plan, page), pages))
            completion = [receiver.send("POST", plan["completeUrl"])[0] for _ in range(2)]
            receiver.endpoint.require_exchange()
            stored = {path.name: path.read_bytes() for path in (receiver.directory / "blobs").iterdir()}
        self.assertEqual(statuses, [204] * 24)
        self.assertEqual(completion, [201, 201])
        self.assertEqual(stored, {digest(page): page for page in pages})

    def test_completion_requires_every_missing_blob(self):
        files = export_files()
        with Receiver() as receiver:
            _status, _type, plan = receiver.plan(files)
            self.assertEqual(receiver.put(plan, files["view/page-0/index.html"]), 204)
            self.assertEqual(receiver.send("POST", plan["completeUrl"])[0], 409)
            with self.assertRaisesRegex(EndpointError, "before every missing blob"):
                receiver.endpoint.require_exchange()

    def test_refused_requests_fail_the_exchange(self):
        files = export_files()
        first, second = files["view/page-0/index.html"], files["view/page-1/index.html"]

        def after_completion(receiver, plan):
            receiver.put(plan, first)
            receiver.put(plan, second)
            receiver.send("POST", plan["completeUrl"])
            return receiver.put(plan, first)

        cases = (
            (
                "invalid authorization",
                401,
                lambda receiver, plan: receiver.send(
                    "POST", plan["completeUrl"], token="b" * 64
                )[0],
            ),
            (
                "Content-Type application/octet-stream",
                415,
                lambda receiver, plan: receiver.put(plan, first, "text/plain"),
            ),
            (
                "an empty completion",
                400,
                lambda receiver, plan: receiver.send(
                    "POST", plan["completeUrl"], b"{}", "application/json"
                )[0],
            ),
            ("a blob after completion", 409, after_completion),
        )
        for message, expected, action in cases:
            with self.subTest(message=message), Receiver() as receiver:
                _status, _type, plan = receiver.plan(files)
                self.assertEqual(action(receiver, plan), expected)
                with self.assertRaisesRegex(EndpointError, message):
                    receiver.endpoint.require_exchange()

    def test_a_malformed_request_or_plan_is_refused(self):
        with Receiver() as receiver:
            address = urlsplit(receiver.url)
            with socket.create_connection((address.hostname, address.port), timeout=10) as raw:
                raw.sendall(b"NOT HTTP\r\n\r\n")
                while raw.recv(1024):
                    pass
            with self.assertRaisesRegex(EndpointError, "malformed request"):
                receiver.endpoint.require_exchange()
        with Receiver() as receiver:
            status = receiver.send("POST", receiver.url, b"plan", "text/plain")[0]
            self.assertEqual(status, 415)
            with self.assertRaisesRegex(EndpointError, "application/gzip"):
                receiver.endpoint.require_exchange()


if __name__ == "__main__":
    unittest.main()
