//! Job permissions and dispatch secrets that the workflow trust boundary allows.

use serde_json::Value;

const ID_TOKEN_JOBS: [&str; 16] = [
    "release",
    "plan",
    "cloud-provider-plan",
    "publish",
    "origin-router",
    "preview-platform",
    "plan-main-preview",
    "plan-production",
    "apply-main-preview",
    "apply-production",
    "sync-main-preview-email",
    "sync-production-email",
    "catalogue-main-preview",
    "catalogue-production",
    "release-main-preview",
    "release-production",
];
const PROVIDER: &str = "${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}";
const PLAN: &str = "${{ secrets.GCP_PLAN_SERVICE_ACCOUNT }}";
const DEPLOY_SECRETS: [&str; 5] = [
    PROVIDER,
    PLAN,
    "${{ secrets.GCP_APPLY_SERVICE_ACCOUNT }}",
    "${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}",
    "${{ secrets.GCP_POSTMARK_SYNC_SERVICE_ACCOUNT }}",
];
const FOUNDATION_SECRETS: [&str; 3] = [
    PROVIDER,
    PLAN,
    "${{ secrets.GCP_FOUNDATION_SERVICE_ACCOUNT }}",
];

pub(super) fn allowed_permission(
    workflow: &str,
    job: &str,
    permission: &str,
    value: &Value,
) -> bool {
    match (permission, value.as_str()) {
        ("contents", Some("read")) => true,
        ("pull-requests", Some("write")) => {
            workflow == "preview" && matches!(job, "release" | "deploy-pr" | "close-pr")
        }
        ("actions", Some("read")) => workflow == "deploy" && job == "foundation-gate",
        ("id-token", Some("write")) => {
            ID_TOKEN_JOBS.contains(&job) || (workflow == "foundation" && job == "apply")
        }
        _ => false,
    }
}

pub(super) fn dispatch_secrets(workflow: &str) -> Option<&'static [&'static str]> {
    match workflow {
        "deploy" => Some(&DEPLOY_SECRETS),
        "foundation" => Some(&FOUNDATION_SECRETS),
        _ => None,
    }
}
