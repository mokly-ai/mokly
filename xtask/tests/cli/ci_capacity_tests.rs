//! Required hosted-job result gate behavior.

use std::collections::BTreeMap;
use std::fs;
use std::process::Command;

use serde::Deserialize;

use super::support::repository;

#[derive(Deserialize)]
struct Workflow {
    jobs: BTreeMap<String, Job>,
}

#[derive(Deserialize)]
struct Job {
    #[serde(default)]
    needs: Vec<String>,
    steps: Vec<Step>,
}

#[derive(Deserialize)]
struct Step {
    run: Option<String>,
    #[serde(default)]
    env: BTreeMap<String, String>,
}

fn workflow() -> Workflow {
    let text = fs::read_to_string(repository().join(".github/workflows/ci.yml")).unwrap();
    serde_saphyr::from_str(&text).unwrap()
}

#[test]
fn aggregate_rejects_every_unsuccessful_required_job_state() {
    let workflow = workflow();
    let required = &workflow.jobs["required"];
    assert_eq!(
        required.needs,
        [
            "profile",
            "repository",
            "viewer",
            "browser",
            "native",
            "static-delivery",
            "check",
            "images",
            "plan"
        ]
    );
    let gate = required
        .steps
        .iter()
        .find(|step| {
            ["CHECK_RESULT", "IMAGE_RESULT", "PLAN_RESULT"]
                .iter()
                .all(|name| step.env.contains_key(*name))
        })
        .unwrap();
    let command = gate.run.as_deref().unwrap();

    let names: Vec<_> = gate.env.keys().map(String::as_str).collect();
    assert!(gate_status(command, &names, &vec!["success"; names.len()]));
    for index in 0..names.len() {
        for state in ["failure", "cancelled", "skipped"] {
            let mut results = vec!["success"; names.len()];
            results[index] = state;
            assert!(
                !gate_status(command, &names, &results),
                "job {index} accepted {state}"
            );
        }
    }
}

fn gate_status(command: &str, names: &[&str], results: &[&str]) -> bool {
    Command::new("/bin/bash")
        .args(["-euo", "pipefail", "-c", command])
        .env_clear()
        .envs(
            names
                .iter()
                .zip(results)
                .map(|(name, result)| (*name, *result)),
        )
        .status()
        .unwrap()
        .success()
}
