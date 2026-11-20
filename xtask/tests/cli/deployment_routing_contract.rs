//! Shared origin-router and preview-platform workflow assertions.

use serde_json::{Map, Value, json};

pub(super) fn valid_deploy_routing(jobs: &Map<String, Value>) -> bool {
    let worker = &jobs["origin-router"];
    let platform = &jobs["preview-platform"];
    worker["permissions"] == json!({"contents": "read", "id-token": "write"})
        && worker["env"]["GCP_WORKLOAD_IDENTITY_PROVIDER"]
            == "${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}"
        && worker["env"]["GCP_SERVICE_ACCOUNT"] == "${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}"
        && worker["env"]["CLOUDFLARE_ACCOUNT_ID"] == "${{ vars.CLOUDFLARE_ACCOUNT_ID }}"
        && worker["env"]["CLOUDFLARE_API_TOKEN"].is_null()
        && worker["env"]["MKC_DOMAIN"] == "${{ vars.MKC_DOMAIN }}"
        && worker["env"]["MKC_CLOUDFLARE_ZONE_ID"] == "${{ vars.MKC_CLOUDFLARE_ZONE_ID }}"
        && !worker.to_string().contains("CLOUDFLARE_WORKER_API_TOKEN")
        && worker["needs"] == json!(["build", "foundation-gate"])
        && jobs["publish"]["needs"] == json!(["build", "foundation-gate"])
        && worker["outputs"]["enabled"] == "${{ steps.credentials.outputs.enabled }}"
        && has_gated_action(worker, "google-github-actions/auth@")
        && has_gated_action(worker, "google-github-actions/setup-gcloud@")
        && has_gated_command(worker, "npm ci")
        && has_gated_command(worker, "npm run configure --workspace @mokly-cloud/worker")
        && has_gated_command(worker, "bash infra/scripts/deploy-origin-router.sh")
        && platform["needs"] == json!(["publish", "origin-router"])
        && platform["outputs"]["enabled"] == "${{ steps.credentials.outputs.enabled }}"
        && platform["env"]["MKC_PREVIEW_INGRESS_IP"] == "${{ vars.MKC_PREVIEW_INGRESS_IP }}"
        && platform["env"]["MKC_PREVIEW_BLOBS_BUCKET"] == "${{ vars.MKC_PREVIEW_BLOBS_BUCKET }}"
        && has_gated_command(platform, "bash infra/scripts/preview-platform.sh")
        && jobs["plan-main-preview"]["needs"]
            == json!(["publish", "origin-router", "preview-platform"])
        && jobs["plan-main-preview"]["if"]
            == "github.ref == 'refs/heads/main' && vars.MKC_CLOUD_CUTOVER_ENABLED == 'true' && (needs.publish.outputs.enabled == 'true' && needs.origin-router.outputs.enabled == 'true' && needs.preview-platform.outputs.enabled == 'true')"
}

fn has_gated_action(job: &Value, action: &str) -> bool {
    job["steps"].as_array().is_some_and(|steps| {
        steps.iter().any(|step| {
            step["uses"]
                .as_str()
                .is_some_and(|value| value.starts_with(action))
                && step["if"] == "steps.credentials.outputs.enabled == 'true'"
        })
    })
}

fn has_gated_command(job: &Value, command: &str) -> bool {
    job["steps"].as_array().is_some_and(|steps| {
        steps.iter().any(|step| {
            step["run"]
                .as_str()
                .is_some_and(|run| run.contains(command))
                && step["if"] == "steps.credentials.outputs.enabled == 'true'"
        })
    })
}
