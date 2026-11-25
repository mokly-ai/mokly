#!/usr/bin/env python3
"""Validate namespace state and invoke PR preview cloud lifecycle operations."""

import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys

from preview_lifecycle_cloud import delete_dns, upsert_dns
from preview_lifecycle_core import CommandFailure, preview_parts
from preview_lifecycle_gcp import change_iam, delete_objects


def load_stdin():
    value = json.load(sys.stdin)
    if not isinstance(value, dict):
        raise ValueError("expected a Kubernetes JSON object")
    return value


def secret_value(secret, name, key):
    if secret.get("kind") != "Secret" or secret.get("metadata", {}).get("name") != name:
        raise ValueError(f"expected Secret/{name}")
    if secret.get("type") != "Opaque":
        raise ValueError(f"Secret/{name} must be Opaque")
    encoded = secret.get("data", {}).get(key)
    if not isinstance(encoded, str):
        raise ValueError(f"Secret/{name} is missing {key}")
    try:
        return base64.b64decode(encoded, validate=True).decode("ascii")
    except (binascii.Error, UnicodeDecodeError) as error:
        raise ValueError(f"Secret/{name} has invalid {key}") from error


def validate_postgres_secret():
    secret = load_stdin()
    password = secret_value(secret, "postgres-credentials", "password")
    url = secret_value(secret, "postgres-credentials", "url")
    if not re.fullmatch(r"[a-f0-9]{64}", password):
        raise ValueError("Secret/postgres-credentials password must be 64 lowercase hex characters")
    expected = f"postgres://mokly:{password}@postgres:5432/mokly?sslmode=disable&connect_timeout=5"
    if url != expected:
        raise ValueError("Secret/postgres-credentials URL does not match its password")


def validate_signing_secret():
    secret = load_stdin()
    key = secret_value(secret, "catalogue-signing-key", "catalogue-signing-key")
    if not re.fullmatch(r"[a-f0-9]{64}", key):
        raise ValueError("Secret/catalogue-signing-key must contain 64 lowercase hex characters")


def preview_secret():
    secret = load_stdin()
    value = secret_value(secret, "preview-sign-in", "preview-sign-in")
    if not re.fullmatch(r"[a-f0-9]{64}", value):
        raise ValueError("Secret/preview-sign-in must contain 64 lowercase hex characters")
    return value


def validate_preview_secret():
    preview_secret()


def write_private(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(value)


def generate_postgres(directory):
    password = secrets.token_hex(32)
    url = f"postgres://mokly:{password}@postgres:5432/mokly?sslmode=disable&connect_timeout=5"
    write_private(Path(directory) / "password", password)
    write_private(Path(directory) / "url", url)


def generate_signing(directory):
    write_private(Path(directory) / "catalogue-signing-key", secrets.token_hex(32))


def generate_preview(directory):
    write_private(Path(directory) / "preview-sign-in", secrets.token_hex(32))


def preview_verifier():
    try:
        password = sys.stdin.buffer.read().decode("utf-8").strip()
    except UnicodeDecodeError:
        raise ValueError("preview password must be UTF-8") from None
    if len(password) < 20:
        print("Warning: preview password has fewer than 20 characters.", file=sys.stderr)
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=5, dklen=32)
    encoded_salt = base64.b64encode(salt).decode("ascii").rstrip("=")
    encoded_hash = base64.b64encode(digest).decode("ascii").rstrip("=")
    sys.stdout.write(f"$scrypt$ln=14,r=8,p=5${encoded_salt}${encoded_hash}")


def extract_preview(path):
    write_private(Path(path), preview_secret())


def helm_revision():
    value = json.load(sys.stdin)
    if not isinstance(value, list) or len(value) > 1:
        raise ValueError("Helm release listing is malformed")
    if not value:
        return
    revision = value[0].get("revision") if isinstance(value[0], dict) else None
    if not isinstance(revision, (str, int)) or not re.fullmatch(r"[1-9][0-9]*", str(revision)):
        raise ValueError("Helm deployed revision is malformed")
    print(revision)


def run(arguments):
    if not arguments:
        raise ValueError("supply a lifecycle command")
    command, *values = arguments
    if command == "validate" and len(values) == 1:
        preview_parts(values[0])
    elif command == "validate-postgres-secret" and not values:
        validate_postgres_secret()
    elif command == "validate-signing-secret" and not values:
        validate_signing_secret()
    elif command == "validate-preview-secret" and not values:
        validate_preview_secret()
    elif command == "generate-postgres" and len(values) == 1:
        generate_postgres(values[0])
    elif command == "generate-signing" and len(values) == 1:
        generate_signing(values[0])
    elif command == "generate-preview" and len(values) == 1:
        generate_preview(values[0])
    elif command == "preview-verifier" and not values:
        preview_verifier()
    elif command == "extract-preview" and len(values) == 1:
        extract_preview(values[0])
    elif command == "helm-revision" and not values:
        helm_revision()
    elif command == "dns-upsert" and len(values) == 2:
        upsert_dns(values[0], values[1])
    elif command == "dns-delete" and len(values) == 2:
        delete_dns(values[0], values[1])
    elif command == "iam-upsert" and len(values) == 1:
        change_iam(values[0], True)
    elif command == "iam-remove" and len(values) == 1:
        change_iam(values[0], False)
    elif command == "objects-delete" and len(values) == 1:
        delete_objects(values[0])
    else:
        raise ValueError(f"invalid arguments for {command}")


def main():
    try:
        run(sys.argv[1:])
    except (CommandFailure, KeyError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Preview lifecycle failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
