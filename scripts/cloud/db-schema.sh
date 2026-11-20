#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?Set DATABASE_URL to a migrated Postgres database}"
generated_schema="$(mktemp)"
trap 'rm -f "$generated_schema"' EXIT
diesel print-schema > "$generated_schema"
python3 - "$generated_schema" <<'PY'
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text()
parts = text.split("// @generated automatically by Diesel CLI.")[1:]
expected_tables = {
    "build": {"builds"},
    "build_output": {"build_upload_grants", "build_log_chunks", "build_checks"},
    "authentication": {"users", "sessions", "magic_links", "auth_rate_limits"},
    "platform": {
        "organizations",
        "memberships",
        "projects",
        "project_grants",
        "project_tokens",
    },
    "billing": {
        "billing_customers",
        "billing_subscriptions",
        "billing_subscription_items",
        "billing_deliveries",
    },
    "billing_commands": {"billing_checkout_sessions", "billing_seat_commands"},
    "slug": {"organization_slugs", "project_slugs"},
    "integration": {"integrations"},
    "publication": {"publications", "blobs", "publication_files"},
    "publication_events": {
        "publication_events",
        "publication_branch_aliases",
        "catalogue_grants",
    },
    "publication_screens": {"publication_screen_views"},
    "github_installation": {
        "github_installations",
        "github_repositories",
        "github_project_repositories",
    },
    "github_identity": {"github_user_identities", "github_oauth_flows"},
    "github_delivery": {"github_webhook_deliveries"},
    "github_refs": {"github_pull_requests", "github_branches", "github_check_runs"},
}
groups = {}
for content in parts:
    tables = set(re.findall(r"(?m)^    ([a-z][a-z0-9_]*) \([^\n]*\) \{$", content))
    for name, expected in expected_tables.items():
        if tables == expected:
            groups[name] = content
            break
expected = set(expected_tables)
if set(groups) != expected:
    raise SystemExit("Expected the schema groups configured in diesel.toml")
for name, content in groups.items():
    path = Path("crates/mkc-db/src/schema") / (name + ".rs")
    path.write_text("//! @generated automatically by Diesel CLI." + content.rstrip() + "\n")
PY
cargo fmt --all
