//! Unprivileged preview catalogue capture and artifact transfer contracts.

use std::fs;

use serde_json::Value;

use super::support::repository;

fn workflow() -> Value {
    let source = fs::read_to_string(repository().join(".github/workflows/preview.yml")).unwrap();
    serde_saphyr::from_str(&source).unwrap()
}

#[test]
fn capture_uses_full_history_without_credentials_secrets_or_caches() {
    let source = workflow();
    let capture = &source["jobs"]["capture"];
    assert_eq!(capture["needs"], serde_json::json!(["prepare"]));
    assert_eq!(
        capture["if"],
        "github.event_name == 'pull_request_target' && github.event.pull_request.head.repo.full_name == github.repository && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.prepare.outputs.action == 'deploy')"
    );
    assert_eq!(
        capture["permissions"],
        serde_json::json!({"contents": "read"})
    );
    assert!(capture["environment"].is_null());
    assert!(capture["secrets"].is_null());
    assert!(capture["defaults"].is_null());
    assert_eq!(capture["timeout-minutes"], 20);
    let steps = capture["steps"].as_array().unwrap();
    let checkout = steps
        .iter()
        .find(|step| step["with"]["ref"] == "${{ needs.prepare.outputs.revision }}")
        .unwrap();
    assert!(checkout["with"]["path"].is_null());
    assert!(checkout["with"]["token"].is_null());
    assert_eq!(checkout["with"]["fetch-depth"], 0);
    assert_eq!(checkout["with"]["persist-credentials"], false);
    let checkouts: Vec<_> = steps
        .iter()
        .filter(|step| {
            step["uses"]
                .as_str()
                .is_some_and(|action| action.starts_with("actions/checkout@"))
        })
        .collect();
    assert_eq!(checkouts.len(), 1);
    for step in checkouts {
        assert_eq!(step["with"]["persist-credentials"], false);
    }
    let node = steps
        .iter()
        .find(|step| {
            step["uses"]
                .as_str()
                .is_some_and(|action| action.starts_with("actions/setup-node@"))
        })
        .unwrap();
    assert_eq!(node["with"]["node-version-file"], ".nvmrc");
    assert_eq!(node["with"]["package-manager-cache"], false);
    assert!(node["with"]["cache"].is_null());
    assert!(
        steps
            .iter()
            .any(|step| step["run"] == "npm install --global npm@11.21.0")
    );
    let rendered = capture.to_string();
    assert!(!rendered.contains("actions/cache@"));
    assert!(!rendered.contains("secrets."));
    assert!(!rendered.contains("github.token"));
    assert!(!rendered.contains("id-token"));
}

#[test]
fn capture_runs_pr_tool_and_transfers_the_exchange_directory_to_release() {
    let source = workflow();
    let jobs = &source["jobs"];
    let steps = jobs["capture"]["steps"].as_array().unwrap();
    let command = steps
        .iter()
        .find(|step| {
            step["run"]
                .as_str()
                .is_some_and(|run| run.contains("capture-catalogue.py"))
        })
        .unwrap();
    assert_eq!(
        command["run"],
        "python3 infra/scripts/capture-catalogue.py \"$ENVIRONMENT\" --checkout . --branch \"$HEAD_REF\" --repository \"$CAPTURE_REPOSITORY\""
    );
    assert!(command["working-directory"].is_null());
    assert_eq!(
        command["env"],
        serde_json::json!({
            "ENVIRONMENT": "${{ needs.prepare.outputs.environment }}",
            "HEAD_REF": "${{ github.event.pull_request.head.ref }}",
            "MKC_REVISION": "${{ needs.prepare.outputs.revision }}",
            "CAPTURE_REPOSITORY": "${{ github.repository }}"
        })
    );
    let upload = steps
        .iter()
        .find(|step| step["with"]["name"] == "seed-catalogue")
        .unwrap();
    assert_eq!(upload["with"]["path"], ".context/seed/catalogue");
    assert_eq!(upload["with"]["retention-days"], 1);
    assert_eq!(upload["with"]["if-no-files-found"], "error");
    let release = &jobs["release"];
    assert!(release["if"].as_str().unwrap().contains("always()"));
    let release_steps = release["steps"].as_array().unwrap();
    let download = release_steps
        .iter()
        .find(|step| step["with"]["name"] == "seed-catalogue")
        .unwrap();
    assert!(
        download["if"]
            .as_str()
            .unwrap()
            .contains("needs.capture.result == 'success'")
    );
    assert_eq!(download["with"]["path"], ".context/seed/catalogue");
}
