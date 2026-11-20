"""Thread-safe progress of the one upload exchange a capture receiver accepts."""

from datetime import datetime, timedelta, timezone
import os
import secrets
import threading


EXPIRY = timedelta(minutes=60)


class ExchangeState:
    """Thread-safe progress of the one upload exchange the receiver accepts."""

    def __init__(self, directory, token, advertise_gzip=False):
        self.directory = directory
        self.blobs = directory / "blobs"
        self.token = token
        self.advertise_gzip = advertise_gzip
        self.upload_id = secrets.token_hex(16)
        self.origin = ""
        self.planning = False
        self.plan = None
        self.stored = set()
        self.completed = False
        self.errors = []
        self.lock = threading.Lock()

    def fail(self, message):
        with self.lock:
            self.errors.append(message)

    def begin_plan(self):
        """Claim the single plan request; every later plan is refused."""
        with self.lock:
            first = not self.planning
            self.planning = True
            return first

    def accept_plan(self, plan):
        with self.lock:
            self.plan = plan

    def plan_document(self):
        """Render plan v1 with URLs on the receiver's own loopback origin."""
        expires = (datetime.now(timezone.utc) + EXPIRY).isoformat(timespec="milliseconds")
        base = f"{self.origin}/uploads/{self.upload_id}"
        with self.lock:
            missing = sorted(self.plan.missing)
        document = {
            "schemaVersion": 1,
            "upload": {"id": self.upload_id, "expiresAt": expires.replace("+00:00", "Z")},
            "missing": missing,
            "blobUrl": base + "/blobs/{sha256}",
            "completeUrl": base + "/complete",
        }
        if self.advertise_gzip:
            document["blobEncodings"] = ["gzip"]
        return document

    def expected_size(self, digest):
        """Return a missing blob's declared size, or the refusal for this PUT."""
        with self.lock:
            if self.completed:
                return None, (409, "capture receiver received a blob after completion")
            if self.plan is None or digest not in self.plan.missing:
                return None, (404, "capture receiver received a blob outside the upload plan")
            return self.plan.missing[digest], None

    def store(self, digest, partial):
        """Keep the first verified copy; a repeated hash is accepted once."""
        with self.lock:
            if digest in self.stored:
                partial.unlink()
                return
            os.replace(partial, self.blobs / digest)
            self.stored.add(digest)

    def complete(self):
        """Complete the exchange once every missing blob arrived, else refuse."""
        with self.lock:
            if self.plan is None:
                return "capture receiver received completion before the upload plan"
            if not self.stored.issuperset(self.plan.missing):
                return "capture receiver received completion before every missing blob"
            self.completed = True
            return None
