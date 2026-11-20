//! Exact status and proof schemas required by the release evidence reader.

use chrono::{DateTime, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::frozen::HEAD;
use super::harness::Harness;

pub(crate) fn assert_timestamp(value: &Value) {
    let timestamp = value.as_str().unwrap();
    assert_eq!(timestamp.len(), 20);
    assert!(timestamp.ends_with('Z'));
    assert_eq!(
        timestamp.parse::<DateTime<Utc>>().unwrap().to_rfc3339(),
        timestamp.replace('Z', "+00:00")
    );
}

pub(crate) fn assert_seeded(
    harness: &Harness,
    run: &str,
    pr: Option<u32>,
    upload_status: u16,
) -> Value {
    let environment = pr.map_or_else(
        || "local".to_owned(),
        |number| format!("preview-pr-{number}"),
    );
    let status = harness.json(run, "seed-status.json");
    assert_eq!(
        status,
        json!({
            "schemaVersion": 1, "environment": environment, "revision": HEAD,
            "signIn": "accepted", "project": "seeded", "checkedAt": status["checkedAt"],
        })
    );
    assert_timestamp(&status["checkedAt"]);
    let proof = harness.json(run, "seed-proof.json");
    assert_eq!(
        proof,
        json!({
            "schemaVersion": 1, "environment": environment, "revision": HEAD,
            "workspaceSlug": "mokly-ai", "projectSlug": "mokly",
            "projectId": proof["projectId"], "publicationId": proof["publicationId"],
            "publicationState": "ready", "pullRequest": pr,
            "viewerUrl": format!("http://localhost:8081/mokly-ai/mokly/publications/{}?view=changes", proof["publicationId"].as_str().unwrap()),
            "uploadStatus": upload_status, "checkedAt": proof["checkedAt"],
        })
    );
    for field in ["projectId", "publicationId"] {
        let value = proof[field].as_str().unwrap();
        assert_eq!(Uuid::parse_str(value).unwrap().to_string(), value);
    }
    assert_timestamp(&proof["checkedAt"]);
    proof
}

pub(crate) fn assert_failed(harness: &Harness, run: &str, sign_in: &str) {
    let status = harness.json(run, "seed-status.json");
    assert_eq!(
        status,
        json!({
            "schemaVersion": 1, "environment": "preview-pr-123", "revision": HEAD,
            "signIn": sign_in, "project": "failed", "checkedAt": status["checkedAt"],
        })
    );
    assert_timestamp(&status["checkedAt"]);
    assert_eq!(harness.get(run, "seed-proof.json"), None);
}
