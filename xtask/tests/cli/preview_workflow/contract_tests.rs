//! Workflow identity, evidence transfer and aggregate gate tests.

use super::support::{run_preview_gate, workflow};

#[test]
fn preview_separates_build_identity_from_trusted_release_and_comment() {
    let source = workflow();
    let jobs = &source["jobs"];
    assert_eq!(
        source["permissions"],
        serde_json::json!({"contents": "read"})
    );
    assert_eq!(
        source["on"]["pull_request_target"]["types"],
        serde_json::json!(["labeled", "unlabeled", "synchronize", "reopened", "closed"])
    );
    assert_eq!(source["concurrency"]["cancel-in-progress"], false);
    assert_eq!(jobs["build"]["needs"], serde_json::json!(["prepare"]));
    assert_eq!(
        jobs["release"]["needs"],
        serde_json::json!(["prepare", "build", "capture"])
    );
    assert_eq!(
        jobs["required"]["needs"],
        serde_json::json!(["prepare", "build", "capture", "release"])
    );
    assert_eq!(
        jobs["build"]["permissions"],
        serde_json::json!({"contents": "read"})
    );
    assert_eq!(
        jobs["release"]["permissions"],
        serde_json::json!({
            "contents": "read", "id-token": "write", "pull-requests": "write"
        })
    );
    assert!(jobs["release"]["if"].as_str().unwrap().contains("always()"));
    assert_eq!(jobs["required"]["if"], "${{ always() }}");
    let build = &jobs["build"]["steps"];
    assert!(build.to_string().contains("source/.context/images/*.tar"));
    assert!(build.to_string().contains("build-release.sh"));
    assert!(!build.to_string().contains("secrets."));
    let release = &jobs["release"]["steps"];
    for name in [
        "preview-deploy.sh",
        "preview-destroy.sh",
        "preview-comment.py",
    ] {
        assert!(release.to_string().contains(name), "{name}");
    }
    for step in release.as_array().unwrap() {
        if step["uses"]
            .as_str()
            .is_some_and(|action| action.starts_with("actions/checkout@"))
        {
            assert_eq!(step["with"]["ref"], "main");
        }
    }
    for (id, output) in [
        ("smoke", "deploy"),
        ("evidence", "evidence"),
        ("seed", "seed"),
        ("seed_evidence", "seed_evidence"),
        ("cleanup", "destroy"),
        ("comment", "comment"),
    ] {
        assert_eq!(
            jobs["release"]["outputs"][id],
            format!("${{{{ steps.{output}.outcome }}}}")
        );
    }
    assert!(
        release
            .to_string()
            .contains("github.paginate(github.rest.issues.listComments")
    );
    assert!(release.to_string().contains("comment.user?.type === 'Bot'"));
    assert!(release.to_string().contains("<!-- mokly-preview -->"));
    let upload = release
        .as_array()
        .unwrap()
        .iter()
        .find(|step| step["with"]["name"] == "preview-evidence-pr-${{ github.event.number }}")
        .unwrap();
    assert_eq!(upload["if"], "${{ always() }}");
    assert_eq!(upload["with"]["if-no-files-found"], "warn");
    assert_eq!(upload["with"]["retention-days"], 14);
    assert_eq!(
        upload["with"]["path"],
        ".context/deployment-smoke.json\n.context/seed-status.json\n.context/seed-proof.json\n"
    );
}

#[test]
fn preview_aggregate_rejects_missing_failed_and_cancelled_evidence() {
    for action in ["deploy", "destroy"] {
        for missing in [
            "CLOUD_ENABLED",
            "CAPTURE_RESULT",
            "SMOKE_RESULT",
            "EVIDENCE_RESULT",
            "SEED_RESULT",
            "SEED_EVIDENCE_RESULT",
            "CLEANUP_RESULT",
            "COMMENT_RESULT",
        ] {
            let relevant = match action {
                "deploy" => missing != "CLEANUP_RESULT",
                _ => !matches!(
                    missing,
                    "SMOKE_RESULT" | "EVIDENCE_RESULT" | "SEED_RESULT" | "SEED_EVIDENCE_RESULT"
                ),
            };
            if !relevant {
                continue;
            }
            for result in ["", "failure", "cancelled", "skipped"] {
                let broken = if missing == "CLOUD_ENABLED" {
                    "false"
                } else if missing == "CAPTURE_RESULT" && action == "destroy" && result == "skipped"
                {
                    "success"
                } else {
                    result
                };
                let build = if action == "deploy" {
                    "success"
                } else {
                    "skipped"
                };
                let inputs = [
                    ("PREPARE_RESULT", "success"),
                    ("BUILD_RESULT", build),
                    ("RELEASE_RESULT", "success"),
                    ("PREVIEW_ACTION", action),
                    ("CLOUD_ENABLED", "true"),
                    (
                        "CAPTURE_RESULT",
                        if action == "deploy" {
                            "success"
                        } else {
                            "skipped"
                        },
                    ),
                    ("SMOKE_RESULT", "success"),
                    ("EVIDENCE_RESULT", "success"),
                    (
                        "SEED_RESULT",
                        if action == "deploy" {
                            "success"
                        } else {
                            "skipped"
                        },
                    ),
                    (
                        "SEED_EVIDENCE_RESULT",
                        if action == "deploy" {
                            "success"
                        } else {
                            "skipped"
                        },
                    ),
                    ("CLEANUP_RESULT", "success"),
                    ("COMMENT_RESULT", "success"),
                ]
                .map(|(name, value)| (name, if name == missing { broken } else { value }));
                assert!(!run_preview_gate(&inputs), "{action}/{missing}/{result}");
            }
        }
    }
}

#[test]
#[should_panic(expected = "gate inputs must match its step env")]
fn preview_gate_refuses_an_input_its_step_does_not_declare() {
    run_preview_gate(&[
        ("PREPARE_RESULT", "success"),
        ("BUILD_RESULT", "success"),
        ("RELEASE_RESULT", "success"),
        ("PREVIEW_ACTION", "deploy"),
        ("CLOUD_ENABLED", "true"),
        ("CAPTURE_RESULT", "success"),
        ("SMOKE_RESULT", "success"),
        ("SUITE_RESULT", "success"),
        ("EVIDENCE_RESULT", "success"),
        ("SEED_RESULT", "success"),
        ("SEED_EVIDENCE_RESULT", "success"),
        ("CLEANUP_RESULT", "skipped"),
        ("COMMENT_RESULT", "success"),
    ]);
}
