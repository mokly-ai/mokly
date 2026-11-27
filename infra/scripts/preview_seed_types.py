"""Shared JSON, private credential and evidence helpers for preview scripts."""

from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Optional
import uuid


REVISION = re.compile(r"[a-f0-9]{40}")


class SeedError(ValueError):
    """A preview seed failure safe to include in workflow diagnostics."""


@dataclass(frozen=True)
class Configuration:
    """Validated preview identity, catalogue input and evidence paths."""

    environment: str
    revision: str
    pull_request: Optional[int]
    app_origin: str
    catalogue: Path
    status_file: Path
    proof_file: Path


def canonical_uuid(value, label):
    """Require and return a canonical UUID string."""
    if not isinstance(value, str):
        raise SeedError(f"{label} is not a canonical UUID")
    try:
        parsed = uuid.UUID(value)
    except ValueError as error:
        raise SeedError(f"{label} is not a canonical UUID") from error
    if str(parsed) != value:
        raise SeedError(f"{label} is not a canonical UUID")
    return value


def read_json(path):
    """Read one JSON object from a file."""
    try:
        value = json.loads(Path(path).read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SeedError(f"{Path(path).name} is not a readable JSON object") from error
    if not isinstance(value, dict):
        raise SeedError(f"{Path(path).name} is not a JSON object")
    return value


def atomic_json(path, value):
    """Atomically replace one private evidence JSON file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, delete=False
        ) as output:
            temporary = Path(output.name)
            os.fchmod(output.fileno(), 0o600)
            json.dump(value, output, sort_keys=True, separators=(",", ":"))
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    except OSError:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        raise


def validate_evidence(configuration):
    """Require successful status and proof for the tested revision."""
    status = read_json(configuration.status_file)
    proof = read_json(configuration.proof_file)
    if set(status) != {
        "schemaVersion",
        "environment",
        "revision",
        "signIn",
        "project",
        "checkedAt",
    }:
        raise SeedError("seed status has unexpected fields")
    if (
        status.get("schemaVersion") != 1
        or status.get("environment") != configuration.environment
        or status.get("revision") != configuration.revision
        or status.get("signIn") != "accepted"
        or status.get("project") != "seeded"
    ):
        raise SeedError("seed status does not prove the tested revision")
    if set(proof) != {
        "schemaVersion",
        "environment",
        "revision",
        "workspaceSlug",
        "projectSlug",
        "projectId",
        "publicationId",
        "publicationState",
        "pullRequest",
        "viewerUrl",
        "uploadStatus",
        "checkedAt",
    }:
        raise SeedError("seed proof has unexpected fields")
    if (
        proof.get("schemaVersion") != 1
        or proof.get("environment") != configuration.environment
        or proof.get("revision") != configuration.revision
        or proof.get("workspaceSlug") != "mokly-ai"
        or proof.get("projectSlug") != "mokly"
        or proof.get("publicationState") != "ready"
        or proof.get("pullRequest") != configuration.pull_request
        or proof.get("uploadStatus") not in (200, 201)
        or not isinstance(proof.get("viewerUrl"), str)
        or not proof["viewerUrl"].startswith(configuration.app_origin + "/")
    ):
        raise SeedError("seed proof does not prove the tested revision")
    canonical_uuid(proof.get("projectId"), "seed proof project ID")
    canonical_uuid(proof.get("publicationId"), "seed proof publication ID")
