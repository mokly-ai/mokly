//! The Required CI guard fails closed for every prerequisite job result.

use std::process::Command;

use crate::support::{named, read_yaml, repository_root, steps};

const RESULT_VARIABLES: [&str; 5] = [
    "REPOSITORY_RESULT",
    "VIEWER_RESULT",
    "BROWSER_RESULT",
    "NATIVE_RESULT",
    "STATIC_DELIVERY_RESULT",
];

#[test]
fn required_ci_fails_closed_for_every_prerequisite_result() {
    let workflow = read_yaml(".github/workflows/ci.yml");
    let required = &workflow["jobs"]["required"];
    assert!(!required.is_badvalue(), "ci.yml has a required job");
    let guard = named(steps(required), "Require every verification job")
        .and_then(|step| step["run"].as_str())
        .expect("the required job runs its guard script");

    let successful: Vec<(&str, &str)> = RESULT_VARIABLES
        .iter()
        .map(|variable| (*variable, "success"))
        .collect();
    assert!(run_guard(guard, &successful), "every success passes");

    let mut accepted = Vec::new();
    for variable in RESULT_VARIABLES {
        for result in ["failure", "skipped", "cancelled", ""] {
            let results: Vec<(&str, &str)> = successful
                .iter()
                .map(|&(name, value)| (name, if name == variable { result } else { value }))
                .collect();
            if run_guard(guard, &results) {
                let shown = if result.is_empty() { "empty" } else { result };
                accepted.push(format!("{variable} rejects {shown}"));
            }
        }
    }
    assert_eq!(accepted, Vec::<String>::new());
}

/// Run the guard script with the given job results; true when it passes.
fn run_guard(script: &str, results: &[(&str, &str)]) -> bool {
    Command::new("bash")
        .args([
            "--noprofile",
            "--norc",
            "-e",
            "-o",
            "pipefail",
            "-c",
            script,
        ])
        .current_dir(repository_root())
        .envs(results.iter().copied())
        .status()
        .expect("bash starts")
        .success()
}
