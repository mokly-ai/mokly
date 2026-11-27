//! Stripe catalogue sync jobs keep secrets scoped and consume reviewed inputs.

use std::fs;
use std::process::{Command, Output};

use serde_json::Value;
use tempfile::TempDir;

use super::support::repository;

fn workflow() -> Value {
    let text = fs::read_to_string(repository().join(".github/workflows/deploy.yml")).unwrap();
    serde_saphyr::from_str(&text).unwrap()
}

fn billing_result(job: &Value, value: &str) -> Output {
    let directory = TempDir::new().unwrap();
    let values = directory.path().join("values.json");
    let output = directory.path().join("github-output");
    fs::write(&values, value).unwrap();
    let step = job["steps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|step| step["id"] == "billing")
        .unwrap();
    let script = format!("{}\ncat \"$GITHUB_OUTPUT\"", step["run"].as_str().unwrap());
    Command::new("bash")
        .args(["-euo", "pipefail", "-c", &script])
        .env("ENVIRONMENT", "main-preview")
        .env("GITHUB_OUTPUT", &output)
        .env("MKC_RELEASE_VALUES", &values)
        .output()
        .unwrap()
}

#[test]
fn catalogue_jobs_use_reviewed_values_and_keep_the_key_step_scoped() {
    let workflow = workflow();
    let jobs = &workflow["jobs"];
    for (environment, artifact, secret) in [
        (
            "main-preview",
            "plan-main-preview",
            "mkc-main-preview-stripe-catalogue-key",
        ),
        (
            "production",
            "plan-production",
            "mkc-production-stripe-catalogue-key",
        ),
    ] {
        let job_id = format!("catalogue-{environment}");
        let job = &jobs[job_id.clone()];
        assert_eq!(job["runs-on"], "ubuntu-24.04");
        assert_eq!(
            job["permissions"],
            serde_json::json!({"contents": "read", "id-token": "write"})
        );
        assert_eq!(
            job["outputs"]["completed"],
            "${{ steps.billing.outputs.completed || steps.sync.outputs.completed }}"
        );
        assert_eq!(job["env"]["ENVIRONMENT"], environment);
        assert_eq!(
            job["env"]["MKC_RELEASE_VALUES"],
            format!(".context/plans/{environment}/values.json")
        );
        assert_eq!(
            job["env"]["GCP_SERVICE_ACCOUNT"],
            "${{ secrets.GCP_DEPLOY_SERVICE_ACCOUNT }}"
        );

        let steps = job["steps"].as_array().unwrap();
        let actions: Vec<_> = steps
            .iter()
            .filter_map(|step| step["uses"].as_str())
            .collect();
        assert_eq!(
            actions,
            [
                "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
                "dtolnay/rust-toolchain@6bed0761d98439e5a578e2877258200ad565ba87",
                "Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6",
                "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
                "google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093",
                "google-github-actions/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db",
            ]
        );
        assert_eq!(steps[0]["with"]["persist-credentials"], false);
        assert_eq!(steps[1]["with"]["toolchain"], "1.98.1");
        assert_eq!(steps[3]["with"]["shared-key"], "stripe-catalogue");
        assert_eq!(steps[6]["with"]["name"], artifact);
        assert_eq!(
            steps[6]["with"]["path"],
            format!(".context/plans/{environment}")
        );

        let check = steps
            .iter()
            .position(|step| step["run"] == "cargo xtask stripe-catalogue check")
            .unwrap();
        let authenticate = steps
            .iter()
            .position(|step| {
                step["uses"]
                    .as_str()
                    .is_some_and(|action| action.starts_with("google-github-actions/auth@"))
            })
            .unwrap();
        assert!(check < authenticate);
        let auth_condition = "steps.credentials.outputs.enabled == 'true' && steps.billing.outputs.enabled == 'true'";
        assert_eq!(steps[authenticate]["if"], auth_condition);

        let operation_step = steps.iter().find(|step| step["id"] == "sync").unwrap();
        assert_eq!(operation_step["if"], auth_condition);
        assert_eq!(operation_step["env"]["STRIPE_CATALOGUE_SECRET"], secret);
        let script = operation_step["run"].as_str().unwrap();
        let read = script
            .find("gcloud secrets versions access latest")
            .unwrap();
        let mask = script.find("::add-mask::$stripe_catalogue_key").unwrap();
        let use_key = script
            .find("MKC_STRIPE_CATALOGUE_KEY=\"$stripe_catalogue_key\" cargo xtask")
            .unwrap();
        assert!(read < mask && mask < use_key);
        assert!(script.contains("if ! stripe_catalogue_key="));
        assert!(script.contains("::error::Unable to read $STRIPE_CATALOGUE_SECRET"));
        assert!(script.contains("stripe-catalogue sync"));
        assert!(script.contains("--environment \"$ENVIRONMENT\" --apply"));
        assert!(!script.contains("export MKC_STRIPE_CATALOGUE_KEY"));
        assert!(!script.contains("stripe_catalogue_key\" >"));
        assert!(!script.contains("tee "));
        assert!(!script.contains("--data-file"));
        assert!(!job.to_string().contains("GITHUB_ENV"));
    }
}

#[test]
fn reviewed_billing_flag_skips_without_authentication_and_fails_when_untyped() {
    let workflow = workflow();
    for job_id in ["catalogue-main-preview", "catalogue-production"] {
        let job = &workflow["jobs"][job_id];
        let disabled = billing_result(job, r#"{"billing":{"enabled":false}}"#);
        assert!(disabled.status.success(), "{disabled:?}");
        let disabled_stdout = String::from_utf8_lossy(&disabled.stdout);
        assert!(disabled_stdout.contains("::notice::"));
        assert!(disabled_stdout.contains("enabled=false"));
        assert!(disabled_stdout.contains("completed=true"));
        let enabled = billing_result(job, r#"{"billing":{"enabled":true}}"#);
        assert!(enabled.status.success(), "{enabled:?}");
        let enabled_stdout = String::from_utf8_lossy(&enabled.stdout);
        assert!(!enabled_stdout.contains("::notice::"));
        assert!(enabled_stdout.contains("enabled=true"));
        assert!(!enabled_stdout.contains("completed=true"));
        let invalid = billing_result(job, r#"{"billing":{"enabled":"true"}}"#);
        assert!(!invalid.status.success());
        assert!(String::from_utf8_lossy(&invalid.stderr).contains("::error::"));
    }
}

#[test]
fn deployment_workflows_never_run_catalogue_archive() {
    let directory = repository().join(".github/workflows");
    for entry in fs::read_dir(&directory).unwrap() {
        let path = entry.unwrap().path();
        if !path.is_file() {
            continue;
        }
        let text = fs::read_to_string(&path).unwrap();
        assert!(
            !text.contains("stripe-catalogue archive"),
            "{} invokes automatic catalogue archival",
            path.display()
        );
    }
}
