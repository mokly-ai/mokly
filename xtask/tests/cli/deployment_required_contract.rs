//! The required deployment result waits for every workflow gate.

use serde_json::Value;

pub(super) fn valid_required_job(required: &Value, name: &str) -> bool {
    let needs = match name {
        "ci" => vec![
            "profile",
            "repository",
            "viewer",
            "browser",
            "native",
            "static-delivery",
            "check",
            "images",
            "plan",
        ],
        "deploy" => vec![
            "foundation-gate",
            "build",
            "publish",
            "origin-router",
            "preview-platform",
            "plan-main-preview",
            "apply-main-preview",
            "sync-main-preview-email",
            "catalogue-main-preview",
            "release-main-preview",
            "plan-production",
            "apply-production",
            "sync-production-email",
            "catalogue-production",
            "release-production",
        ],
        "foundation" => vec!["plan", "apply"],
        "preview" => vec!["prepare", "build", "capture", "release"],
        _ => unreachable!(),
    };
    required["if"] == "${{ always() }}"
        && required["needs"] == serde_json::json!(needs)
        && required["steps"].as_array().unwrap().iter().any(|step| {
            step["run"]
                .as_str()
                .is_some_and(|run| run.contains("success"))
        })
}
