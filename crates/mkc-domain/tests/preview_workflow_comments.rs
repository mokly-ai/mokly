//! Execute the preview workflow's final comment step with seed and cleanup outcomes.

#![expect(
    clippy::unwrap_used,
    reason = "Integration fixture setup must fail on invalid input."
)]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

fn repository() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn workflow() -> serde_json::Value {
    let source = fs::read_to_string(repository().join(".github/workflows/preview.yml")).unwrap();
    serde_saphyr::from_str(&source).unwrap()
}

/// Run `Prepare final comment` from a checkout that initially has no context.
fn final_comment(action: &str, deploy: &str, evidence: &str, cleanup: &str) -> String {
    let source = workflow();
    let step = source["jobs"]["release"]["steps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|step| step["id"] == "comment-body")
        .unwrap();
    let checkout = TempDir::new().unwrap();
    let scripts = checkout.path().join("infra/scripts");
    fs::create_dir_all(&scripts).unwrap();
    for name in [
        "preview-comment.py",
        "preview_lifecycle_core.py",
        "preview_seed_types.py",
    ] {
        fs::copy(
            repository().join("infra/scripts").join(name),
            scripts.join(name),
        )
        .unwrap();
    }
    if action == "deploy" && deploy == "success" && evidence == "success" {
        fs::create_dir_all(checkout.path().join(".context")).unwrap();
        fs::write(
            checkout.path().join(".context/seed-status.json"),
            format!(
                "{{\"schemaVersion\":1,\"environment\":\"preview-pr-42\",\"revision\":\"{}\",\"signIn\":\"accepted\",\"project\":\"seeded\",\"checkedAt\":\"2026-09-27T12:00:00Z\"}}",
                "a".repeat(40)
            ),
        )
        .unwrap();
        fs::write(checkout.path().join(".context/seed-proof.json"), "{}\n").unwrap();
    }
    let status = Command::new("bash")
        .args(["-euc", step["run"].as_str().unwrap()])
        .current_dir(checkout.path())
        .envs([
            ("PREVIEW_ACTION", action),
            ("DEPLOY_RESULT", deploy),
            ("EVIDENCE_RESULT", evidence),
            ("CAPTURE_RESULT", "success"),
            ("SEED_RESULT", "success"),
            ("SEED_EVIDENCE_RESULT", "success"),
            ("CLEANUP_RESULT", cleanup),
            ("ENVIRONMENT", "preview-pr-42"),
            ("MKC_REVISION", &"a".repeat(40)),
            ("MKC_DOMAIN", "example.com"),
            ("MKC_CATALOGUE_BASE_DOMAIN", "catalogues.net"),
            (
                "PREVIEW_RUN_URL",
                "https://github.com/mokly-ai/mokly/actions/runs/123",
            ),
        ])
        .status()
        .unwrap();
    assert!(status.success(), "{action}/{deploy}/{evidence}/{cleanup}");
    fs::read_to_string(checkout.path().join(".context/preview-comment.md")).unwrap()
}

#[test]
fn successful_comment_links_to_sign_in_and_sample_project_without_a_credential() {
    let comment = final_comment("deploy", "success", "success", "skipped");
    assert!(comment.contains("- App: https://pr-42.preview.example.com/sign-in"));
    assert!(comment.contains(
        "- Sample project: https://pr-42.preview.example.com/mokly-ai/mokly/pull-requests/42"
    ));
    assert!(!comment.contains("- Open preview:"), "{comment}");
    assert!(!comment.contains("#secret="), "{comment}");
}

#[test]
fn final_comment_is_written_without_an_existing_context_directory() {
    for (action, deploy, evidence, cleanup, expected) in [
        (
            "destroy",
            "skipped",
            "skipped",
            "success",
            "Preview removed",
        ),
        (
            "destroy",
            "skipped",
            "skipped",
            "failure",
            "Cleanup failed. Rerun the workflow.",
        ),
        ("deploy", "success", "success", "skipped", "Checks passed"),
        (
            "deploy",
            "failure",
            "skipped",
            "skipped",
            "Checks failed. Open the run for details.",
        ),
    ] {
        let comment = final_comment(action, deploy, evidence, cleanup);
        assert!(
            comment.contains(&format!("Status: **{expected}**")),
            "{action}/{deploy}/{evidence}/{cleanup}: {comment}"
        );
    }
}
