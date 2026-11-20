//! Shared preview workflow parser and aggregate runner.

use std::collections::BTreeSet;
use std::fs;
use std::process::Command;

use serde_json::Value;

use super::super::support::repository;

pub(super) fn workflow() -> Value {
    let source = fs::read_to_string(repository().join(".github/workflows/preview.yml")).unwrap();
    serde_saphyr::from_str(&source).unwrap()
}

/// Run the `Preview required` gate and answer whether it passed.
///
/// Every caller must supply exactly the variables the gate step declares in
/// its `env`, so a removed input or a new required one cannot pass silently.
pub(crate) fn run_preview_gate(inputs: &[(&str, &str)]) -> bool {
    let source = workflow();
    let step = &source["jobs"]["required"]["steps"][0];
    let declared: BTreeSet<&str> = step["env"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    let supplied: BTreeSet<&str> = inputs.iter().map(|(name, _)| *name).collect();
    assert_eq!(supplied.len(), inputs.len(), "duplicate gate input");
    assert_eq!(supplied, declared, "gate inputs must match its step env");
    Command::new("bash")
        .args(["-euc", step["run"].as_str().unwrap()])
        .envs(inputs.iter().copied())
        .status()
        .unwrap()
        .success()
}
