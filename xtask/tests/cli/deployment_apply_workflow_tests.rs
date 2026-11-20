//! Stable environment plans are applied exactly once after merge and before rollout.

use std::fs;

use serde_json::{Value, json};

use super::support::repository;

fn command_position(job: &Value, command: &str) -> Option<usize> {
    job["steps"].as_array()?.iter().position(|step| {
        step["run"]
            .as_str()
            .is_some_and(|run| run.contains(command))
    })
}

fn artifact_position(job: &Value, action: &str, name: &str, path: &str) -> Option<usize> {
    job["steps"].as_array()?.iter().position(|step| {
        step["uses"]
            .as_str()
            .is_some_and(|value| value.starts_with(action))
            && step["with"]["name"] == name
            && step["with"]["path"] == path
    })
}

fn exact_apply(job: &Value, artifact: &str, path: &str) -> bool {
    artifact_position(job, "actions/download-artifact@", artifact, path)
        .zip(command_position(
            job,
            "terraform-environment.sh \"$ENVIRONMENT\" apply",
        ))
        .is_some_and(|(download, apply)| download < apply)
        && command_position(job, "terraform-environment.sh \"$ENVIRONMENT\" plan").is_none()
}

fn exact_plan(job: &Value, artifact: &str, path: &str) -> bool {
    command_position(job, "terraform-environment.sh \"$ENVIRONMENT\" plan")
        .zip(artifact_position(
            job,
            "actions/upload-artifact@",
            artifact,
            path,
        ))
        .is_some_and(|(plan, upload)| plan < upload)
}

fn ordered(workflow: &Value) -> bool {
    let jobs = &workflow["jobs"];
    let preview_plan = &jobs["plan-main-preview"];
    let preview_apply = &jobs["apply-main-preview"];
    let preview_email = &jobs["sync-main-preview-email"];
    let production_email = &jobs["sync-production-email"];
    let preview_catalogue = &jobs["catalogue-main-preview"];
    let preview_release = &jobs["release-main-preview"];
    let production_plan = &jobs["plan-production"];
    let production_apply = &jobs["apply-production"];
    let production_catalogue = &jobs["catalogue-production"];
    let production_release = &jobs["release-production"];
    preview_plan["needs"] == json!(["publish", "origin-router", "preview-platform"])
        && exact_plan(
            preview_plan,
            "plan-main-preview",
            ".context/plans/main-preview",
        )
        && preview_apply["needs"] == json!(["plan-main-preview"])
        && preview_apply["environment"].is_null()
        && preview_apply
            .to_string()
            .contains("GCP_APPLY_SERVICE_ACCOUNT")
        && exact_apply(
            preview_apply,
            "plan-main-preview",
            ".context/plans/main-preview",
        )
        && preview_email["needs"] == json!(["apply-main-preview"])
        && preview_email["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-main-preview.outputs.applied == 'true')"
        && preview_catalogue["needs"] == json!(["plan-main-preview", "apply-main-preview"])
        && preview_catalogue["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-main-preview.outputs.applied == 'true')"
        && preview_release["needs"]
            == json!([
                "apply-main-preview",
                "catalogue-main-preview",
                "sync-main-preview-email"
            ])
        && preview_release["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-main-preview.outputs.applied == 'true' && needs.catalogue-main-preview.outputs.completed == 'true')"
        && preview_release["environment"].is_null()
        && jobs.get("catalogue-archive-main-preview").is_none()
        && production_plan["environment"].is_null()
        && production_plan["needs"] == json!(["publish", "release-main-preview"])
        && production_plan["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.release-main-preview.outputs.deployed == 'true' && vars.MKC_PRODUCTION_ENABLED == 'true')"
        && exact_plan(
            production_plan,
            "plan-production",
            ".context/plans/production",
        )
        && production_apply["needs"] == json!(["plan-production"])
        && production_apply["environment"].is_null()
        && production_apply
            .to_string()
            .contains("GCP_APPLY_SERVICE_ACCOUNT")
        && exact_apply(
            production_apply,
            "plan-production",
            ".context/plans/production",
        )
        && production_email["needs"] == json!(["apply-production"])
        && production_email["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-production.outputs.applied == 'true')"
        && production_catalogue["needs"] == json!(["plan-production", "apply-production"])
        && production_catalogue["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-production.outputs.applied == 'true')"
        && production_release["needs"]
            == json!([
                "release-main-preview",
                "apply-production",
                "catalogue-production",
                "sync-production-email"
            ])
        && production_release["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.apply-production.outputs.applied == 'true' && needs.catalogue-production.outputs.completed == 'true')"
        && production_release["environment"].is_null()
        && jobs.get("catalogue-archive-production").is_none()
        && jobs
            .as_object()
            .unwrap()
            .values()
            .all(|job| !job["needs"].to_string().contains("catalogue-archive-"))
}

#[test]
fn merge_authorizes_exact_plan_apply_before_each_stable_rollout() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let workflow: Value = serde_saphyr::from_str(&text).unwrap();
    assert!(ordered(&workflow));
    for (path, replacement) in [
        ("/jobs/release-production/needs", json!(["build"])),
        ("/jobs/plan-production/environment", json!("production")),
        ("/jobs/apply-production/environment", json!("production")),
        ("/jobs/sync-production-email/needs", json!(["build"])),
        (
            "/jobs/release-main-preview/needs",
            json!(["apply-main-preview"]),
        ),
        ("/jobs/plan-production/if", json!("always()")),
        (
            "/jobs/catalogue-main-preview/needs",
            json!(["apply-main-preview"]),
        ),
        (
            "/jobs/catalogue-production/if",
            json!("needs.plan-production.result == 'success'"),
        ),
        (
            "/jobs/release-main-preview/environment",
            json!("main-preview"),
        ),
        ("/jobs/apply-main-preview/needs", json!(["publish"])),
    ] {
        let mut changed = workflow.clone();
        if path.ends_with("/environment") {
            let job = path.split('/').nth(2).unwrap();
            changed["jobs"][job]["environment"] = replacement;
        } else {
            *changed.pointer_mut(path).unwrap() = replacement;
        }
        assert!(!ordered(&changed), "{path}");
    }

    let mut changed = workflow.clone();
    let steps = changed["jobs"]["apply-production"]["steps"]
        .as_array_mut()
        .unwrap();
    let download = steps
        .iter()
        .position(|step| step["with"]["name"] == "plan-production")
        .unwrap();
    let apply = steps
        .iter()
        .position(|step| {
            step["run"]
                .as_str()
                .is_some_and(|run| run.contains("terraform-environment.sh"))
        })
        .unwrap();
    steps.swap(download, apply);
    assert!(
        !ordered(&changed),
        "apply before artifact download must fail"
    );
}
