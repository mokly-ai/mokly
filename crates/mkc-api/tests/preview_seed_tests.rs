//! The one-time seed command uses real Postgres and local seed storage.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

#[path = "preview_seed/mod.rs"]
mod seed_support;

use seed_support::evidence::{assert_failed, assert_seeded, assert_timestamp};
use seed_support::harness::Harness;

#[test]
fn fresh_seed_writes_exact_evidence_and_public_publication() {
    for pull_request in [Some(123), None] {
        let harness = Harness::new();
        harness.stage("fresh", pull_request);
        harness.catalogue("fresh", pull_request, false);
        let output = harness.run("fresh", &[]);
        assert_eq!(output.code, 0, "{}", output.log);
        let proof = assert_seeded(&harness, "fresh", pull_request, 201);
        harness.assert_publication(&proof, pull_request);
        let counts = harness.counts();
        assert_eq!(
            (counts.users, counts.workspaces, counts.projects),
            (1, 1, 1)
        );
        assert_eq!((counts.tokens, counts.live_tokens, counts.ready), (1, 0, 1));
        assert_eq!(
            (
                counts.sessions,
                counts.repository_links,
                counts.subscriptions
            ),
            (0, 0, 0)
        );
        assert_timestamp(&proof["checkedAt"]);
    }
}

#[test]
fn second_run_replays_the_same_publication_and_revokes_both_tokens() {
    let harness = Harness::new();
    harness.stage("first", Some(123));
    harness.catalogue("first", Some(123), false);
    let first = harness.run("first", &[]);
    assert_eq!(first.code, 0, "{}", first.log);
    let original = assert_seeded(&harness, "first", Some(123), 201);
    harness.stage("second", Some(123));
    harness.catalogue("second", Some(123), false);
    let second = harness.run("second", &[]);
    assert_eq!(second.code, 0, "{}", second.log);
    let replay = assert_seeded(&harness, "second", Some(123), 200);
    assert_eq!(replay["publicationId"], original["publicationId"]);
    assert_eq!(replay["projectId"], original["projectId"]);
    let counts = harness.counts();
    assert_eq!(
        (counts.users, counts.workspaces, counts.projects),
        (1, 1, 1)
    );
    assert_eq!((counts.tokens, counts.live_tokens, counts.ready), (2, 0, 1));
}

#[test]
fn missing_catalogue_preserves_account_success_without_proof() {
    let harness = Harness::new();
    harness.stage("missing", Some(123));
    let output = harness.run("missing", &[]);
    assert_ne!(output.code, 0);
    assert!(output.log.contains("catalogue missing"), "{}", output.log);
    assert_failed(&harness, "missing", "accepted");
    let counts = harness.counts();
    assert_eq!(
        (counts.users, counts.tokens, counts.publications),
        (1, 0, 0)
    );
}

#[test]
fn catalogue_revision_mismatch_fails_before_token_or_upload() {
    let harness = Harness::new();
    harness.stage("mismatch", Some(123));
    harness.put_json(
        "mismatch",
        "request.json",
        &json!({
            "schemaVersion": 1, "environment": "preview-pr-123",
            "revision": "2222222222222222222222222222222222222222", "pullRequest": 123
        }),
    );
    harness.catalogue("mismatch", Some(123), false);
    let output = harness.run("mismatch", &[]);
    assert_ne!(output.code, 0);
    assert!(output.log.contains("headSha"), "{}", output.log);
    let status = harness.json("mismatch", "seed-status.json");
    assert_eq!(
        status["revision"],
        "2222222222222222222222222222222222222222"
    );
    assert_eq!(status["project"], "failed");
    assert_eq!(status["signIn"], "accepted");
    assert_eq!(harness.get("mismatch", "seed-proof.json"), None);
    let counts = harness.counts();
    assert_eq!((counts.tokens, counts.publications), (0, 0));
}

#[test]
fn existing_free_workspace_fails_with_expected_and_received_plan() {
    let harness = Harness::new();
    harness.stage("free", Some(123));
    let created = harness.run("free", &[("MKC_PREVIEW_SIGN_IN_PLAN", "free")]);
    assert_ne!(created.code, 0);
    harness.stage("retained-free", Some(123));
    harness.catalogue("retained-free", Some(123), false);
    let output = harness.run("retained-free", &[]);
    assert_ne!(output.code, 0);
    assert!(output.log.contains("plan"), "{}", output.log);
    assert!(output.log.contains("team"), "{}", output.log);
    assert!(output.log.contains("free"), "{}", output.log);
    assert_failed(&harness, "retained-free", "accepted");
    let counts = harness.counts();
    assert_eq!(
        (counts.workspaces, counts.tokens, counts.publications),
        (1, 0, 0)
    );
}

#[test]
fn failed_upload_still_revokes_its_project_token() {
    for (run, reason) in [("bad-blob", "blob"), ("bad-plan", "unsupported")] {
        let harness = Harness::new();
        harness.stage(run, Some(123));
        if run == "bad-plan" {
            harness.refused_plan(run);
        } else {
            harness.catalogue(run, Some(123), true);
        }
        let output = harness.run(run, &[]);
        assert_ne!(output.code, 0);
        assert!(output.log.contains(reason), "{}", output.log);
        assert_failed(&harness, run, "accepted");
        let counts = harness.counts();
        assert_eq!(
            (
                counts.tokens,
                counts.live_tokens,
                counts.publications,
                counts.ready
            ),
            (1, 0, 1, 0),
            "{run}"
        );
    }
}
