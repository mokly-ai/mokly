//! Configuration and request failures leave no seed result files.

use serde_json::json;

use super::harness::Harness;

#[test]
fn disabled_or_unconfigured_preview_fails_before_any_write() {
    let harness = Harness::new();
    harness.stage("disabled", Some(123));
    let output = harness.run(
        "disabled",
        &[
            ("MKC_ENV", "production"),
            ("MKC_MAILER", "postmark"),
            ("POSTMARK_FROM", "test@example.com"),
            ("POSTMARK_SERVER_TOKEN", "test"),
            ("MKC_SITE_ORIGIN", "https://mokly.ai"),
            ("MKC_APP_ORIGIN", "https://app.mokly.ai"),
            ("MKC_API_ORIGIN", "https://api.mokly.ai"),
            ("MKC_CATALOGUE_ORIGIN", "https://mokly-catalogue.net"),
            ("MKC_FILE_STORE", "gcs"),
            ("MKC_GCS_BUCKET", "unused-seed-test"),
        ],
    );
    assert_ne!(output.code, 0);
    assert!(
        output.log.contains("PreviewSignInDisallowed"),
        "{}",
        output.log
    );
    let missing = harness.run(
        "disabled",
        &[
            ("MKC_PREVIEW_SIGN_IN_SECRET", ""),
            ("MKC_PREVIEW_SIGN_IN_EMAIL", ""),
            ("MKC_PREVIEW_SIGN_IN_PLAN", ""),
        ],
    );
    assert_ne!(missing.code, 0);
    assert!(missing.log.contains("Configuration"), "{}", missing.log);
    assert_eq!(harness.get("disabled", "seed-status.json"), None);
    assert_eq!(harness.get("disabled", "seed-proof.json"), None);
    assert_eq!(harness.table_count(), 0);
}

#[test]
fn missing_or_invalid_request_writes_no_status_or_proof() {
    let harness = Harness::new();
    harness.put_json(
        "invalid",
        "request.json",
        &json!({
            "schemaVersion": 1, "environment": "preview-pr-0123",
            "revision": "1111111111111111111111111111111111111111", "pullRequest": 123
        }),
    );
    for run in ["missing-request", "invalid"] {
        let output = harness.run(run, &[]);
        assert_ne!(output.code, 0);
        assert!(output.log.contains("request"), "{}", output.log);
        assert_eq!(harness.get(run, "seed-status.json"), None);
        assert_eq!(harness.get(run, "seed-proof.json"), None);
    }
}
