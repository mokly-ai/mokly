//! Hosted CI contracts and negative workflow fixtures.

use std::fs;

use super::support::repository;
use super::workflow_contract::{Violation, validate};

#[test]
fn ci_pins_tools_checks_pull_requests_and_has_an_unconditional_aggregate() {
    let text = fs::read_to_string(repository().join(".github/workflows/ci.yml")).unwrap();
    assert_eq!(validate(&text), []);
    for (from, to, violation) in [
        (
            "${{ always() }}",
            "${{ success() }}",
            Violation::RequiredGate,
        ),
        ("fetch-depth: 0", "fetch-depth: 1", Violation::Toolchains),
        ("contents: read", "contents: write", Violation::Permissions),
        ("pull_request:", "issue_comment:", Violation::Trigger),
        (
            "cargo xtask check --suite \"$XTASK_COMMAND\"",
            "cargo check",
            Violation::CheckCommand,
        ),
        (
            "cancel-in-progress: true",
            "cancel-in-progress: false",
            Violation::Concurrency,
        ),
        ("--with-deps chromium", "chromium", Violation::Chromium),
        ("createdb mkc_test", "true", Violation::Postgres),
        (
            "MKC_TEST_DATABASE_URL:",
            "IGNORED_DATABASE_URL:",
            Violation::Postgres,
        ),
        ("npm ci", "npm install", Violation::Chromium),
        (
            "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a",
            "useblacksmith/checkout@main",
            Violation::ActionPin,
        ),
    ] {
        assert!(validate(&text.replace(from, to)).contains(&violation));
    }
}

#[test]
fn npm_cache_uses_the_workspace_lockfile() {
    let text = fs::read_to_string(repository().join(".github/workflows/ci.yml")).unwrap();
    assert!(!validate(&text).contains(&Violation::NpmCachePath));
    for broken in [
        text.replace(
            "cache-dependency-path: package-lock.json",
            "cache-dependency-path: missing-lock.json",
        ),
        text.replace("cache-dependency-path: package-lock.json", ""),
    ] {
        assert!(validate(&broken).contains(&Violation::NpmCachePath));
    }
}

#[test]
fn origin_router_deploy_uses_the_workspace_lockfile() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let deploy =
        fs::read_to_string(repository().join("infra/scripts/deploy-origin-router.sh")).unwrap();
    assert!(text.contains("cache-dependency-path: package-lock.json"));
    assert!(text.contains("npm ci"));
    assert!(text.contains("bash infra/scripts/deploy-origin-router.sh"));
    assert!(deploy.contains("npm exec --workspace @mokly-cloud/worker -- wrangler deploy"));
}
