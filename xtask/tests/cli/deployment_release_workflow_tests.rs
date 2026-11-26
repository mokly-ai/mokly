//! Release image inputs and preview cleanup preserve the workflow trust boundary.

use std::fs;

use serde_json::{Value, json};

use super::deployment_workflow_tests::validate;
use super::preview_workflow::support::run_preview_gate;
use super::support::repository;

#[test]
fn ci_installs_tools_and_runs_the_automated_image_build_stage() {
    let ci = fs::read_to_string(repository().join(".github/workflows/ci.yml")).unwrap();
    assert!(ci.contains("bash infra/scripts/install-build-tools.sh"));
    assert!(ci.contains("bash infra/scripts/start-buildkit.sh"));
    assert!(ci.contains("cargo xtask check --suite \"$XTASK_COMMAND\""));
    for command in ["cloud-rust", "cloud-app", "cloud-mockups", "cloud-site"] {
        assert!(ci.contains(&format!("command: {command}")));
    }
    assert!(ci.contains("cargo xtask check --suite cloud-infrastructure"));
}

#[test]
fn image_builds_receive_the_requested_revision() {
    for name in ["deploy", "preview"] {
        let text =
            fs::read_to_string(repository().join(format!(".github/workflows/{name}.yml"))).unwrap();
        assert!(!validate(&text, name).contains(&"build-revision"), "{name}");
        for changed in [
            text.replace("build-release.sh", "build-api.sh"),
            text.replace("MKC_REVISION:", "MKC_IGNORED_REVISION:"),
            text.replace("MKC_REVISION:", "MKC_${{ github.sha }}:"),
        ] {
            assert!(validate(&changed, name).contains(&"build-revision"));
        }
    }
}

#[test]
fn stable_release_can_be_dispatched_from_main_with_an_explicit_reset() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: Value = serde_saphyr::from_str(&text).unwrap();
    let reset = &workflow["on"]["workflow_dispatch"]["inputs"]["reset"];
    assert_eq!(workflow["on"]["push"]["branches"], json!(["main"]));
    assert_eq!(reset["type"], "boolean");
    assert_eq!(reset["default"], false);
    assert_eq!(
        reset["description"],
        "Delete all br-main and production database data before release"
    );
    assert_eq!(
        workflow["jobs"]["build"]["if"],
        "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true'"
    );
    for job in ["release-main-preview", "release-production"] {
        assert_eq!(
            workflow["jobs"][job]["env"]["RESET_RELEASE"], "${{ inputs.reset }}",
            "{job}"
        );
    }
}

#[test]
fn preview_cleanup_survives_build_failure_and_never_checks_out_pr_code_with_identity() {
    let text = fs::read_to_string(repository().join(".github/workflows/preview.yml")).unwrap();
    for (from, to, expected) in [
        (
            "ref: main",
            "ref: ${{ github.event.pull_request.head.sha }}",
            "trusted-release",
        ),
        ("unlabeled, synchronize", "synchronize", "preview-cleanup"),
        (
            "cancel-in-progress: false",
            "cancel-in-progress: true",
            "preview-cleanup",
        ),
        ("action != 'skip'", "action == 'deploy'", "preview-cleanup"),
    ] {
        assert!(validate(&text.replace(from, to), "preview").contains(&expected));
    }
    for (
        action,
        build,
        capture,
        release,
        smoke,
        evidence,
        seed,
        seed_evidence,
        cleanup,
        comment,
        passed,
    ) in [
        (
            "deploy", "success", "success", "success", "success", "success", "success", "success",
            "skipped", "success", true,
        ),
        (
            "deploy", "failure", "success", "success", "skipped", "skipped", "skipped", "skipped",
            "skipped", "success", false,
        ),
        (
            "destroy", "skipped", "skipped", "success", "skipped", "skipped", "skipped", "skipped",
            "success", "success", true,
        ),
        (
            "destroy", "skipped", "skipped", "failure", "skipped", "skipped", "skipped", "skipped",
            "failure", "success", false,
        ),
        (
            "skip", "skipped", "skipped", "skipped", "", "", "", "", "", "", true,
        ),
    ] {
        let inputs = [
            ("PREPARE_RESULT", "success"),
            ("PREVIEW_ACTION", action),
            ("BUILD_RESULT", build),
            ("CAPTURE_RESULT", capture),
            ("RELEASE_RESULT", release),
            ("CLOUD_ENABLED", "true"),
            ("SMOKE_RESULT", smoke),
            ("EVIDENCE_RESULT", evidence),
            ("SEED_RESULT", seed),
            ("SEED_EVIDENCE_RESULT", seed_evidence),
            ("CLEANUP_RESULT", cleanup),
            ("COMMENT_RESULT", comment),
        ];
        assert_eq!(
            run_preview_gate(&inputs),
            passed,
            "{action}/{build}/{release}"
        );
    }
}
