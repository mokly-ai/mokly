"""Bounded reading of the gzip plan archive that `mokly publish` sends first."""

from dataclasses import dataclass
import hashlib
import json
import re
import tarfile
from typing import Dict
import zlib


ENVELOPE = "mokly-upload.json"
MARKER = ".mokly-export-artifact"
INDEX = "mokly-viewer/index.json"
MAX_ENVELOPE_BYTES = 16 * 1024
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_BLOBS = 19_999
MAX_BLOB_BYTES = 512 * 1024 * 1024
GZIP_CHUNK_BYTES = 1024 * 1024
DIGEST = re.compile(r"[a-f0-9]{64}")
INVALID_GZIP = "catalogue upload is not a valid gzip archive"


class PlanError(ValueError):
    """A safe diagnostic for a plan archive the capture cannot accept."""


class PlanTooLarge(PlanError):
    """A plan whose missing blobs exceed the capture's count or byte limit."""


@dataclass(frozen=True)
class CapturedPlan:
    """The envelope, marker entry count and missing blobs of one plan archive."""

    envelope: dict
    files: int
    missing: Dict[str, int]


def validate_gzip(path):
    """Stream one complete gzip member and reject any bytes after its trailer."""
    decompressor = zlib.decompressobj(wbits=31)
    try:
        with path.open("rb") as source:
            while chunk := source.read(GZIP_CHUNK_BYTES):
                while chunk:
                    decompressor.decompress(chunk, GZIP_CHUNK_BYTES)
                    chunk = decompressor.unconsumed_tail
                    if decompressor.eof:
                        if chunk or decompressor.unused_data or source.read(1):
                            raise PlanError(INVALID_GZIP)
                        return
    except (OSError, zlib.error) as error:
        raise PlanError(INVALID_GZIP) from error
    raise PlanError(INVALID_GZIP)


def archive_files(archive):
    """Read at most three bounded regular files from an open plan archive."""
    contents = {}
    for member in archive:
        if len(contents) == 3 or member.name in contents or not member.isfile():
            raise PlanError("catalogue upload plan must hold only its envelope, marker and index")
        limit = MAX_ENVELOPE_BYTES if member.name == ENVELOPE else MAX_FILE_BYTES
        if member.size > limit:
            raise PlanError(f"catalogue upload plan file exceeds its size limit: {member.name}")
        stream = archive.extractfile(member)
        if stream is None:
            raise PlanError(INVALID_GZIP)
        contents[member.name] = stream.read()
    return contents


def json_object(data, name):
    """Decode one archived UTF-8 JSON object."""
    try:
        value = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PlanError(f"{name} is not a JSON object") from error
    if not isinstance(value, dict):
        raise PlanError(f"{name} is not a JSON object")
    return value


def marker_entries(data):
    """Return the typed `(path, sha256, size)` entries of a schema 3 marker."""
    marker = json_object(data, MARKER)
    version = marker.get("schemaVersion")
    if type(version) is not int or version != 3:
        raise PlanError("catalogue upload marker must be schema 3")
    files = marker.get("files")
    if not isinstance(files, list):
        raise PlanError("catalogue upload marker is invalid")
    entries = []
    for entry in files:
        if not isinstance(entry, dict):
            raise PlanError("catalogue upload marker is invalid")
        path, digest, size = entry.get("path"), entry.get("sha256"), entry.get("size")
        if (
            not isinstance(path, str)
            or not isinstance(digest, str)
            or not DIGEST.fullmatch(digest)
            or type(size) is not int
            or not 0 <= size <= MAX_FILE_BYTES
        ):
            raise PlanError("catalogue upload marker is invalid")
        entries.append((path, digest, size))
    return entries


def missing_blobs(entries, own):
    """Every distinct declared hash and size except the plan archive's own files."""
    declared = {}
    for _path, digest, size in entries:
        if declared.setdefault(digest, size) != size:
            raise PlanError("catalogue upload marker declares one hash with two sizes")
    missing = {digest: size for digest, size in declared.items() if digest not in own}
    if len(missing) > MAX_BLOBS:
        raise PlanTooLarge("catalogue upload declares more than 19,999 blobs")
    if sum(missing.values()) > MAX_BLOB_BYTES:
        raise PlanTooLarge("catalogue upload declares more than 512 MiB of blobs")
    return missing


def read_plan(path):
    """Validate gzip framing and the envelope, marker and required index versions."""
    validate_gzip(path)
    try:
        with tarfile.open(path, mode="r:gz") as archive:
            contents = archive_files(archive)
    except (EOFError, OSError, tarfile.TarError, zlib.error) as error:
        raise PlanError(INVALID_GZIP) from error
    if ENVELOPE not in contents or MARKER not in contents:
        raise PlanError("catalogue upload plan must contain mokly-upload.json and its marker")
    envelope = json_object(contents[ENVELOPE], ENVELOPE)
    version = envelope.get("schemaVersion")
    if type(version) is not int or version != 3:
        raise PlanError("catalogue upload envelope must be schema 3")
    expected = {ENVELOPE, MARKER, INDEX}
    if set(contents) != expected:
        raise PlanError("catalogue upload plan must hold only its envelope, marker and index")
    entries = marker_entries(contents[MARKER])
    index = json_object(contents[INDEX], INDEX)
    version = index.get("schemaVersion")
    if type(version) is not int or version != 9:
        raise PlanError("catalogue upload index must be schema 9")
    declarations = set(entries)
    own = set()
    for name in sorted(expected - {MARKER}):
        data = contents[name]
        digest = hashlib.sha256(data).hexdigest()
        if (name, digest, len(data)) not in declarations:
            raise PlanError("catalogue upload marker does not declare the archived envelope and index")
        own.add(digest)
    return CapturedPlan(envelope, len(entries), missing_blobs(entries, own))
