//! Deployment workflow trust, permissions and unconditional failure gates.

use std::fs;

use serde_json::Value;

use super::deployment_required_contract::valid_required_job;
use super::deployment_routing_contract::valid_deploy_routing;
use super::deployment_trust_contract::{allowed_permission, dispatch_secrets};
use super::support::repository;

pub(super) fn validate(text: &str, name: &str) -> Vec<&'static str> {
    let workflow: Value = serde_saphyr::from_str(text).unwrap();
    let mut errors = Vec::new();
    if workflow["permissions"] != serde_json::json!({"contents": "read"}) {
        errors.push("permissions");
    }
    let jobs = workflow["jobs"].as_object().unwrap();
    for (id, job) in jobs {
        if let Some(permissions) = job["permissions"].as_object() {
            for (permission, value) in permissions {
                if !allowed_permission(name, id, permission, value) {
                    errors.push("permissions");
                }
            }
        }
        if references_provider_credentials(job) && !has_credential_gate(job) {
            errors.push("credential-gate");
        }
        for step in job["steps"].as_array().unwrap() {
            if let Some(action) = step["uses"].as_str() {
                if !action.split_once('@').is_some_and(|(_, pin)| {
                    pin.len() == 40 && pin.bytes().all(|byte| byte.is_ascii_hexdigit())
                }) {
                    errors.push("action-pin");
                }
                if action.starts_with("google-github-actions/auth@") {
                    let expected_condition = if matches!(
                        id.as_str(),
                        "catalogue-main-preview" | "catalogue-production"
                    ) {
                        "steps.credentials.outputs.enabled == 'true' && steps.billing.outputs.enabled == 'true'"
                    } else {
                        "steps.credentials.outputs.enabled == 'true'"
                    };
                    if step["if"] != expected_condition || job["permissions"]["id-token"] != "write"
                    {
                        errors.push("credential-gate");
                    }
                    for field in ["workload_identity_provider", "service_account"] {
                        if !secret_name(step["with"][field].as_str().unwrap_or_default()) {
                            errors.push("secret-name");
                        }
                    }
                }
                if name == "preview"
                    && id == "release"
                    && action.starts_with("actions/checkout@")
                    && (step["with"]["ref"] != "main"
                        || step["with"]["persist-credentials"] != false)
                {
                    errors.push("trusted-release");
                }
            }
            if step["run"].as_str().is_some_and(|run| run.contains("${{")) {
                errors.push("shell-interpolation");
            }
        }
    }
    for line in text.lines().filter(|line| line.contains("secrets.")) {
        let value = line
            .split_once(':')
            .map(|(_, value)| value.trim())
            .unwrap_or_default();
        if !secret_name(value)
            && value != "${{ secrets.CLOUDFLARE_PAGES_API_TOKEN || secrets.CLOUDFLARE_API_TOKEN }}"
        {
            errors.push("secret-name");
        }
    }
    if text.contains("credentials_json:") || text.contains("PRIVATE KEY") {
        errors.push("long-lived-key");
    }
    if matches!(name, "deploy" | "preview") && text.contains("MKC_SITE_ORIGIN") {
        errors.push("site-origin");
    }
    let dispatchable = workflow["on"]
        .as_object()
        .is_some_and(|on| on.contains_key("workflow_dispatch"));
    if let Some(allowed) = dispatch_secrets(name).filter(|_| dispatchable)
        && text
            .lines()
            .filter_map(secret_value)
            .any(|value| value.contains("secrets.") && !allowed.contains(&value))
    {
        errors.push("dispatch-provider-secret");
    }
    if !valid_required_job(&jobs["required"], name) {
        errors.push("aggregate");
    }
    if matches!(name, "deploy" | "preview") {
        let build = &jobs["build"];
        if build["permissions"] != serde_json::json!({"contents": "read"})
            || !build["environment"].is_null()
            || build.to_string().contains("secrets.")
        {
            errors.push("unprivileged-build");
        }
        let revision = match name {
            "deploy" => "${{ github.sha }}",
            "preview" => "${{ needs.prepare.outputs.revision }}",
            _ => unreachable!(),
        };
        let command = if name == "deploy" {
            "bash infra/scripts/build-release.sh main-preview production"
        } else {
            "bash infra/scripts/build-release.sh \"$ENVIRONMENT\""
        };
        if !build["steps"]
            .as_array()
            .unwrap()
            .iter()
            .any(|step| step["run"] == command && step["env"]["MKC_REVISION"] == revision)
        {
            errors.push("build-revision");
        }
    }
    if name == "preview" {
        let events = &workflow["on"]["pull_request_target"]["types"];
        if events
            != &serde_json::json!(["labeled", "unlabeled", "synchronize", "reopened", "closed"])
            || workflow["concurrency"]["cancel-in-progress"] != false
            || jobs["release"]["if"].as_str().is_none_or(|condition| {
                !condition.contains("always()") || !condition.contains("action != 'skip'")
            })
            || !text.contains("preview-destroy.sh")
        {
            errors.push("preview-cleanup");
        }
    } else if workflow["on"]["push"]["branches"] != serde_json::json!(["main"]) {
        errors.push("main-trigger");
    }
    if name == "ci"
        && (!jobs["cloud-provider-plan"]
            .to_string()
            .contains("SKIP terraform-plan")
            || !jobs["cloud-provider-plan"]
                .to_string()
                .contains("refs/heads/main")
            || !jobs["check"]
                .to_string()
                .contains("infra/scripts/install-tools.sh"))
    {
        errors.push("plan-gate");
    }
    if name == "deploy" && !valid_deploy_routing(jobs) {
        errors.push("origin-router");
    }
    errors
}

fn references_provider_credentials(job: &Value) -> bool {
    provider_credentials(&job["env"])
        || job["steps"].as_array().is_some_and(|steps| {
            steps.iter().any(|step| {
                provider_credentials(&step["env"]) || provider_credentials(&step["with"])
            })
        })
}

fn provider_credentials(value: &Value) -> bool {
    let text = value.to_string();
    [
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_PAGES_API_TOKEN",
        "GCP_SERVICE_ACCOUNT",
        "GCP_WORKLOAD_IDENTITY_PROVIDER",
    ]
    .iter()
    .any(|name| text.contains(name))
}

fn has_credential_gate(job: &Value) -> bool {
    job["steps"].as_array().is_some_and(|steps| {
        steps.iter().any(|step| {
            step["id"] == "credentials"
                && step["run"].as_str().is_some_and(|run| {
                    run.contains("credential-gate.sh")
                        || (run.contains("enabled=true") && run.contains("enabled=false"))
                })
        })
    })
}

fn secret_name(value: &str) -> bool {
    value
        .strip_prefix("${{ secrets.")
        .and_then(|value| value.strip_suffix(" }}"))
        .is_some_and(|name| {
            !name.is_empty()
                && name
                    .bytes()
                    .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'_')
        })
}

fn secret_value(line: &str) -> Option<&str> {
    line.split_once(':').map(|(_, value)| value.trim())
}

#[test]
fn workflows_pin_actions_scope_identity_and_name_secrets() {
    for name in ["ci", "deploy", "foundation", "preview"] {
        let text =
            fs::read_to_string(repository().join(format!(".github/workflows/{name}.yml"))).unwrap();
        let errors = validate(&text, name);
        assert!(errors.is_empty(), "{name}: {errors:?}");
        for (from, to, expected) in [
            ("${{ always() }}", "${{ success() }}", "aggregate"),
            ("contents: read", "contents: write", "permissions"),
            (
                "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
                "useblacksmith/checkout@main",
                "action-pin",
            ),
            (
                "${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}",
                "${{ format('{0}', secrets.GCP_WORKLOAD_IDENTITY_PROVIDER) }}",
                "secret-name",
            ),
            (
                "if: steps.credentials.outputs.enabled == 'true'",
                "if: always()",
                "credential-gate",
            ),
            ("id: credentials", "id: unchecked", "credential-gate"),
        ] {
            let (from, to) = if name == "ci" && from.starts_with("actions/checkout@") {
                (
                    "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a",
                    "useblacksmith/checkout@main",
                )
            } else {
                (from, to)
            };
            assert!(
                validate(&text.replace(from, to), name).contains(&expected),
                "{name}: {expected}"
            );
        }
    }
}

#[test]
fn step_scoped_provider_credentials_still_require_a_job_gate() {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    let moved = text.replacen(
        "        run: bash infra/scripts/start-buildkit.sh",
        "        env:\n          CLOUDFLARE_API_TOKEN: ${{ secrets.SYNTHETIC_PROVIDER_TOKEN }}\n        run: bash infra/scripts/start-buildkit.sh",
        1,
    );
    assert!(validate(&moved, "deploy").contains(&"credential-gate"));
}

#[test]
fn only_the_foundation_workflow_reads_the_foundation_identity() {
    let read = |name: &str| {
        fs::read_to_string(repository().join(format!(".github/workflows/{name}.yml"))).unwrap()
    };
    let deploy = read("deploy").replace(
        "${{ secrets.GCP_APPLY_SERVICE_ACCOUNT }}",
        "${{ secrets.GCP_FOUNDATION_SERVICE_ACCOUNT }}",
    );
    assert!(validate(&deploy, "deploy").contains(&"dispatch-provider-secret"));
    let foundation = read("foundation").replace(
        "${{ secrets.GCP_FOUNDATION_SERVICE_ACCOUNT }}",
        "${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}",
    );
    assert!(validate(&foundation, "foundation").contains(&"dispatch-provider-secret"));
    let reader = read("foundation").replacen("      contents: read\n", "      actions: read\n", 1);
    assert!(validate(&reader, "foundation").contains(&"permissions"));
}
