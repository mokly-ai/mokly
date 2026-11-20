#!/usr/bin/env python3
"""Require exact committed approval for destructive Terraform actions."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

from terraform_approval_format import format_approval
from terraform_plan_roots import ROOTS, Root


APPROVAL_KEYS = {"schemaVersion", "environment", "configurationDigest", "reason", "actions"}
ACTION_KEYS = {"address", "actions"}
DEPOSED_ACTION_KEYS = {"address", "deposed", "actions"}
KNOWN_ACTIONS = {"no-op", "create", "read", "update", "delete", "forget"}


class PolicyError(ValueError):
    """A plan or approval does not satisfy the apply policy."""


def approval_path(repository: Path, root: str) -> Path:
    """Return the canonical approval path for one root instance."""
    return _root(root).approval_path(repository)


def configuration_digest(repository: Path, root: str) -> str:
    """Hash every Terraform source file that can affect the root."""
    files = sorted(
        path
        for directory in _root(root).sources(repository)
        for path in directory.rglob("*")
        if path.is_file()
        and ".terraform" not in path.parts
        and (path.suffix == ".tf" or path.name == ".terraform.lock.hcl")
    )
    if not files:
        raise PolicyError("Terraform configuration files are missing")
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(repository).as_posix().encode()
        digest.update(relative)
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def destructive_actions(plan: object) -> list[dict[str, object]]:
    """Extract canonical delete, replacement, and forget actions from a plan."""
    if (
        not isinstance(plan, dict)
        or not isinstance(plan.get("format_version"), str)
        or plan["format_version"].split(".", 1)[0] != "1"
        or not isinstance(plan.get("resource_changes"), list)
    ):
        raise PolicyError("Terraform plan JSON must contain resource_changes")
    destructive = []
    identities = set()
    for resource in plan["resource_changes"]:
        if not isinstance(resource, dict) or not isinstance(resource.get("change"), dict):
            raise PolicyError("Every resource change must be an object with change details")
        address = resource.get("address")
        deposed = resource.get("deposed")
        actions = resource["change"].get("actions")
        if not isinstance(address, str) or not address:
            raise PolicyError("Every resource change must have a nonempty address")
        if deposed is not None and (not isinstance(deposed, str) or not deposed):
            raise PolicyError(f"Terraform plan has an invalid deposed key for {address}")
        identity = (address, deposed)
        if identity in identities:
            raise PolicyError(f"Terraform plan repeats resource object {address}")
        identities.add(identity)
        if (
            not isinstance(actions, list)
            or not actions
            or not all(isinstance(action, str) and action in KNOWN_ACTIONS for action in actions)
        ):
            raise PolicyError(f"Terraform plan has invalid actions for {address}")
        if "delete" in actions or "forget" in actions:
            action = {"address": address, "actions": actions}
            if deposed is not None:
                action["deposed"] = deposed
            destructive.append(action)
    return sorted(
        destructive, key=lambda item: (item["address"], item.get("deposed", ""))
    )


def trust_violations(root: str, plan: object) -> list[str]:
    """Return trust-resource addresses that the plan deletes, replaces or forgets."""
    definition = _root(root)
    destructive_actions(plan)
    violations = set()
    for resource in plan["resource_changes"] if definition.trust else []:
        previous = resource.get("previous_address")
        if previous is not None and (not isinstance(previous, str) or not previous):
            raise PolicyError(
                f"Terraform plan has an invalid previous address for {resource['address']}"
            )
        if {"delete", "forget"} & set(resource["change"]["actions"]) and (
            definition.trusted(resource["address"]) or definition.trusted(previous)
        ):
            violations.add(resource["address"])
    return sorted(violations)


def approval_document(
    root: str, plan: object, repository: Path, reason: str
) -> dict[str, object]:
    """Build the only accepted approval shape for a destructive plan."""
    _root(root)
    actions = destructive_actions(plan)
    _validate_reason(reason)
    if not actions:
        raise PolicyError("The plan has no destructive actions to approve")
    return {
        "schemaVersion": 1,
        "environment": root,
        "configurationDigest": configuration_digest(repository, root),
        "reason": reason.strip(),
        "actions": actions,
    }


def check(root: str, plan: object, repository: Path, ci: bool = False) -> None:
    """Reject missing, stale, changed, or inexact approvals and CI trust removals.

    In CI the approval must be committed, and no approval authorizes a delete,
    replacement or forget of a trust resource.
    """
    _root(root)
    actions = destructive_actions(plan)
    if ci:
        violations = trust_violations(root, plan)
        if violations:
            raise PolicyError(
                "CI never deletes, replaces or forgets trust resource "
                + ", ".join(violations)
                + "; an operator applies this plan outside GitHub Actions "
                "(docs/ops/foundation.md#destructive-foundation-plans)"
            )
    path = approval_path(repository, root)
    if not actions:
        if path.exists():
            raise PolicyError(f"Destructive approval is stale and must be removed: {path}")
        return
    if not path.is_file():
        raise PolicyError(f"Destructive approval is required at {path}")
    if ci:
        _require_committed(repository, path)
    document = _load_json(path)
    if not isinstance(document, dict) or set(document) != APPROVAL_KEYS:
        raise PolicyError("Destructive approval fields do not match schema version 1")
    if document["schemaVersion"] != 1 or document["environment"] != root:
        raise PolicyError("Destructive approval schema or environment does not match")
    _validate_reason(document["reason"])
    if document["configurationDigest"] != configuration_digest(repository, root):
        raise PolicyError("Destructive approval does not match the Terraform configuration")
    approved = _approval_actions(document["actions"])
    if approved != actions:
        raise PolicyError("Destructive approval actions do not exactly match the plan")


def _approval_actions(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise PolicyError("Destructive approval actions must be an array")
    parsed = []
    for item in value:
        if not isinstance(item, dict) or frozenset(item) not in {
            frozenset(ACTION_KEYS),
            frozenset(DEPOSED_ACTION_KEYS),
        }:
            raise PolicyError("Each destructive approval action must name address and actions")
        candidate = {
            "address": item["address"],
            "change": {"actions": item["actions"]},
        }
        if "deposed" in item:
            candidate["deposed"] = item["deposed"]
        extracted = destructive_actions(
            {"format_version": "1.0", "resource_changes": [candidate]}
        )
        if len(extracted) != 1:
            raise PolicyError("Approval entries must describe destructive actions")
        parsed.extend(extracted)
    canonical = sorted(
        parsed, key=lambda item: (item["address"], item.get("deposed", ""))
    )
    if parsed != canonical:
        raise PolicyError("Destructive approval actions must use canonical address order")
    return parsed


def _load_json(path: Path) -> object:
    def reject_duplicates(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise PolicyError(f"Destructive approval repeats field {key}")
            result[key] = value
        return result

    try:
        return json.loads(path.read_text(), object_pairs_hook=reject_duplicates)
    except (OSError, json.JSONDecodeError) as error:
        raise PolicyError(f"Cannot read destructive approval: {error}") from error


def _require_committed(repository: Path, path: Path) -> None:
    relative = path.relative_to(repository).as_posix()
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", "--", relative],
        cwd=repository,
        capture_output=True,
        check=False,
    )
    if tracked.returncode != 0:
        raise PolicyError("Destructive approval must be committed in the merged revision")
    clean = subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", relative],
        cwd=repository,
        check=False,
    )
    if clean.returncode != 0:
        raise PolicyError("Destructive approval must be unmodified from the merged revision")


def _root(name: str) -> Root:
    if name not in ROOTS:
        raise PolicyError(
            "Destructive approval accepts only the " + ", ".join(sorted(ROOTS)) + " roots"
        )
    return ROOTS[name]


def _validate_reason(reason: object) -> None:
    if not isinstance(reason, str) or not 10 <= len(reason.strip()) <= 500:
        raise PolicyError("Destructive approval reason must contain 10 to 500 characters")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    check_parser = commands.add_parser("check")
    check_parser.add_argument("root")
    check_parser.add_argument("plan", type=Path)
    approval_parser = commands.add_parser("approval")
    approval_parser.add_argument("root")
    approval_parser.add_argument("plan", type=Path)
    approval_parser.add_argument("--reason", required=True)
    return parser


def main() -> int:
    """Run the plan check or print a canonical approval document."""
    arguments = _parser().parse_args()
    repository = Path(__file__).resolve().parents[2]
    try:
        plan = _load_json(arguments.plan)
        if arguments.command == "check":
            check(
                arguments.root,
                plan,
                repository,
                ci=os.environ.get("GITHUB_ACTIONS") == "true",
            )
        else:
            document = approval_document(
                arguments.root, plan, repository, arguments.reason
            )
            if trust_violations(arguments.root, plan):
                print(
                    "Terraform plan policy: CI refuses this plan; apply it as an "
                    "operator and do not commit this approval",
                    file=sys.stderr,
                )
            print(format_approval(document), end="")
    except PolicyError as error:
        print(f"Terraform plan policy: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
