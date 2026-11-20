"""Bounded loopback receiver for one catalogue upload exchange."""

import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
import threading
import zlib

from catalogue_capture_plan import DIGEST, PlanError, PlanTooLarge, read_plan
from catalogue_capture_state import ExchangeState


MAX_PLAN_BYTES = 100 * 1024 * 1024
BODY_CHUNK_BYTES = 1024 * 1024
BODY_TIMEOUT_SECONDS = 60
LENGTH = re.compile(r"0|[1-9][0-9]*")
POSITIVE_LENGTH = re.compile(r"[1-9][0-9]*")
UNEXPECTED = "capture receiver refused an unexpected request"


class EndpointError(ValueError):
    """A safe capture-receiver diagnostic."""


def media_type(value):
    return (value or "").split(";", 1)[0].strip().lower()


def handler_for(state):
    """Build the request handler bound to one exchange's state."""

    class ExchangeHandler(BaseHTTPRequestHandler):
        def log_message(self, _format, *_arguments):
            return

        def parse_request(self):
            self.consumed = False
            if not super().parse_request():
                state.fail("capture receiver refused a malformed request")
                return False
            if self.command in ("POST", "PUT"):
                return True
            self.refuse(405, UNEXPECTED)
            return False

        def respond(self, status, document=None):
            body = b"" if document is None else json.dumps(document).encode()
            try:
                self.send_response(status)
                if document is not None:
                    self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except OSError:
                self.close_connection = True

        def refuse(self, status, message):
            """Record a refusal, drain an unread bounded body and answer `status`."""
            state.fail(message)
            length = self.headers.get("Content-Length", "")
            if not self.consumed and LENGTH.fullmatch(length):
                if int(length) <= MAX_PLAN_BYTES:
                    try:
                        self.read_body(int(length))
                    except (EndpointError, OSError):
                        self.close_connection = True
            self.respond(status)

        def authorized(self):
            supplied = self.headers.get("Authorization", "")
            expected = "Bearer " + state.token
            if secrets.compare_digest(
                supplied.encode("latin-1", "replace"), expected.encode()
            ):
                return True
            self.refuse(401, "capture receiver received invalid authorization")
            return False

        def read_body(self, length, *sinks):
            """Read exactly `length` body bytes, passing each chunk to `sinks`."""
            self.consumed = True
            self.connection.settimeout(BODY_TIMEOUT_SECONDS)
            remaining = length
            while remaining:
                chunk = self.rfile.read(min(BODY_CHUNK_BYTES, remaining))
                if not chunk:
                    raise EndpointError("catalogue upload ended before Content-Length")
                for sink in sinks:
                    sink(chunk)
                remaining -= len(chunk)

        def do_POST(self):
            if self.path == "/":
                self.receive_plan()
            elif self.path == f"/uploads/{state.upload_id}/complete":
                self.receive_completion()
            else:
                self.refuse(404, UNEXPECTED)

        def do_PUT(self):
            prefix = f"/uploads/{state.upload_id}/blobs/"
            digest = self.path[len(prefix):] if self.path.startswith(prefix) else ""
            if not DIGEST.fullmatch(digest):
                self.refuse(404, UNEXPECTED)
            elif self.authorized():
                self.receive_blob(digest)

        def receive_plan(self):
            if not self.authorized():
                return
            if not state.begin_plan():
                self.refuse(409, "capture receiver refused a second upload plan")
                return
            if media_type(self.headers.get("Content-Type")) != "application/gzip":
                self.refuse(415, "capture receiver requires Content-Type application/gzip")
                return
            length = self.headers.get("Content-Length", "")
            if not POSITIVE_LENGTH.fullmatch(length):
                self.refuse(411, "capture receiver requires a positive Content-Length")
                return
            if int(length) > MAX_PLAN_BYTES:
                self.refuse(413, "catalogue upload exceeds 100 MiB")
                return
            path = state.directory / "plan.tar.gz"
            try:
                with path.open("xb") as output:
                    self.read_body(int(length), output.write)
                plan = read_plan(path)
            except PlanTooLarge as error:
                self.refuse(413, str(error))
                return
            except (EndpointError, OSError, PlanError) as error:
                self.refuse(400, str(error))
                return
            state.accept_plan(plan)
            self.respond(200, state.plan_document())

        def receive_blob(self, digest):
            size, refusal = state.expected_size(digest)
            if refusal is not None:
                self.refuse(*refusal)
                return
            if media_type(self.headers.get("Content-Type")) != "application/octet-stream":
                self.refuse(
                    415, "capture receiver requires Content-Type application/octet-stream"
                )
                return
            encoding = self.headers.get("Content-Encoding")
            if encoding not in (None, "gzip"):
                self.refuse(400, "capture receiver received an unsupported Content-Encoding")
                return
            length = self.headers.get("Content-Length", "")
            if not LENGTH.fullmatch(length):
                self.refuse(400, "capture receiver requires a valid Content-Length")
                return
            length = int(length)
            if encoding == "gzip" and length > size:
                self.refuse(400, "capture receiver received an encoded blob larger than its file")
            elif encoding is None and length != size:
                self.refuse(400, "capture receiver received a blob of the wrong length")
            else:
                self.store_blob(digest, size, length, encoding)

        def store_blob(self, digest, size, length, encoding):
            hasher = hashlib.sha256()
            partial = None
            encoded = None
            try:
                descriptor, name = tempfile.mkstemp(dir=state.blobs, prefix=".partial-")
                partial = Path(name)
                if encoding is None:
                    with os.fdopen(descriptor, "wb") as output:
                        self.read_body(length, output.write, hasher.update)
                else:
                    os.close(descriptor)
                    partial.unlink(missing_ok=True)
                    descriptor, name = tempfile.mkstemp(dir=state.blobs, prefix=".encoded-")
                    encoded = Path(name)
                    with os.fdopen(descriptor, "wb") as output:
                        self.read_body(length, output.write)
                    with encoded.open("rb") as source, partial.open("wb") as output:
                        decode_gzip(source, output, size, hasher)
                if hasher.hexdigest() != digest:
                    raise EndpointError(
                        "capture receiver received a blob that does not match its hash"
                    )
                state.store(digest, partial)
            except (EndpointError, OSError) as error:
                if partial is not None:
                    partial.unlink(missing_ok=True)
                if encoded is not None:
                    encoded.unlink(missing_ok=True)
                self.refuse(400, str(error))
                return
            if encoded is not None:
                encoded.unlink(missing_ok=True)
            self.respond(204)

        def receive_completion(self):
            if not self.authorized():
                return
            if (
                self.headers.get("Content-Length", "0") != "0"
                or "Transfer-Encoding" in self.headers
            ):
                self.refuse(400, "capture receiver requires an empty completion")
                return
            refusal = state.complete()
            if refusal is not None:
                self.refuse(409, refusal)
                return
            self.respond(201)

    return ExchangeHandler


class ReceiverServer(ThreadingHTTPServer):
    """Threaded loopback server with room for the CLI's parallel blob requests."""

    daemon_threads = True
    request_queue_size = 64


def decode_gzip(source, output, size, hasher):
    """Decode one bounded gzip member and hash only the decoded bytes."""
    decompressor = zlib.decompressobj(wbits=31)
    decoded = 0
    while chunk := source.read(BODY_CHUNK_BYTES):
        while chunk:
            remaining = size + 1 - decoded
            if remaining <= 0:
                raise EndpointError("capture receiver decoded a blob past its declared size")
            try:
                data = decompressor.decompress(chunk, remaining)
            except zlib.error as error:
                raise EndpointError("capture receiver received invalid gzip data") from error
            if data:
                decoded += len(data)
                if decoded > size:
                    raise EndpointError("capture receiver decoded a blob past its declared size")
                output.write(data)
                hasher.update(data)
            chunk = decompressor.unconsumed_tail
            if decompressor.eof:
                if chunk or decompressor.unused_data or source.read(1):
                    raise EndpointError("capture receiver received invalid gzip data")
                break
        if decompressor.eof:
            break
    if not decompressor.eof or decoded != size:
        raise EndpointError("capture receiver received invalid gzip data")


class CaptureEndpoint:
    """Loopback receiver that accepts exactly one plan, blob and completion exchange."""

    def __init__(self, directory, token, advertise_gzip=False):
        self.state = ExchangeState(directory, token, advertise_gzip)
        self.state.blobs.mkdir()
        self.server = ReceiverServer(("127.0.0.1", 0), handler_for(self.state))
        self.state.origin = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self.state.origin + "/"

    def __exit__(self, _error_type, _error, _traceback):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def raise_refusal(self):
        """Raise the first refused request, which explains a failed CLI run."""
        with self.state.lock:
            errors = list(self.state.errors)
        if errors:
            raise EndpointError(errors[0])

    def require_exchange(self):
        """Require one completed exchange in which no request was refused."""
        self.raise_refusal()
        with self.state.lock:
            planned = self.state.plan is not None
            completed = self.state.completed
        if not planned:
            raise EndpointError("capture receiver did not receive an upload plan")
        if not completed:
            raise EndpointError("capture receiver did not receive the upload completion")
