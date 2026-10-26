//! The daily Rust audit job stays apart from the update job's write access.

use regex::Regex;
use yaml_rust2::Yaml;

use crate::support::{assert_mapping, keys, mapping, read_yaml};

#[test]
fn the_daily_rust_audit_cannot_access_the_update_jobs_write_credentials() {
    let workflow = read_yaml(".github/workflows/dependency-audit.yml");
    let all_jobs: Vec<(&str, &Yaml)> = mapping(&workflow["jobs"], "dependency-audit.yml jobs")
        .iter()
        .map(|(name, job)| {
            assert_mapping(job, "each job");
            (name.as_str().expect("job names are strings"), job)
        })
        .collect();
    let rust: Vec<&(&str, &Yaml)> = all_jobs
        .iter()
        .filter(|(_, job)| commands(job).contains("dependencies:check:rust"))
        .collect();
    assert_eq!(rust.len(), 1);
    let (name, job) = *rust[0];

    let permissions = mapping(&job["permissions"], "the Rust audit permissions");
    assert_eq!(keys(permissions), ["contents"]);
    assert_eq!(job["permissions"]["contents"].as_str(), Some("read"));
    assert_eq!(job["timeout-minutes"].as_i64(), Some(30));
    assert!(
        job["needs"].is_badvalue(),
        "the Rust audit must run when npm automation fails"
    );
    assert!(!mentions_secrets(job), "the Rust audit job uses no secrets");

    let checkout = job_steps(job)
        .iter()
        .find(|step| {
            step["uses"]
                .as_str()
                .unwrap_or_default()
                .starts_with("useblacksmith/checkout@")
        })
        .expect("the Rust audit checks out the repository");
    assert_mapping(&checkout["with"], "the checkout inputs");
    assert_eq!(checkout["with"]["ref"].as_str(), Some("main"));
    assert_eq!(
        checkout["with"]["persist-credentials"],
        Yaml::Boolean(false)
    );
    assert!(checkout["with"]["token"].is_badvalue());
    assert!(commands(job).contains("rustup toolchain install"));
    let rust_steps = job_steps(job);
    let install = rust_steps
        .iter()
        .position(|step| step["run"].as_str() == Some("npm ci --ignore-scripts"));
    let audit = rust_steps
        .iter()
        .position(|step| step["run"].as_str() == Some("npm run dependencies:check:rust"));
    assert!(
        install.is_some_and(|install| audit.is_some_and(|audit| install < audit)),
        "the Rust audit installs npm dependencies before the audit"
    );

    let automation: Vec<&(&str, &Yaml)> = all_jobs
        .iter()
        .filter(|(_, job)| commands(job).contains("dependency-audit-pr.mjs"))
        .collect();
    assert_eq!(automation.len(), 1);
    let (automation_name, automation_job) = *automation[0];
    assert_ne!(automation_name, name);
    assert_mapping(&automation_job["permissions"], "the update job permissions");
    assert_eq!(
        automation_job["permissions"]["contents"].as_str(),
        Some("write")
    );
    let toolchain = Regex::new(r"\bcargo\b|\brustup\b|dependencies:check:rust").unwrap();
    assert!(!toolchain.is_match(&commands(automation_job)));
}

/// The steps of a job, which must be a list of mappings.
fn job_steps(job: &Yaml) -> &[Yaml] {
    let steps = job["steps"].as_vec().expect("each job has a steps list");
    for step in steps {
        assert_mapping(step, "each step");
    }
    steps
}

/// The run scripts of a job joined by newlines.
fn commands(job: &Yaml) -> String {
    job_steps(job)
        .iter()
        .map(|step| step["run"].as_str().unwrap_or_default())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Whether any key or text value of a YAML tree names `secrets.`.
fn mentions_secrets(value: &Yaml) -> bool {
    match value {
        Yaml::String(text) => text.contains("secrets."),
        Yaml::Array(items) => items.iter().any(mentions_secrets),
        Yaml::Hash(entries) => entries
            .iter()
            .any(|(key, value)| mentions_secrets(key) || mentions_secrets(value)),
        _ => false,
    }
}
