//! Workflows use the smallest Blacksmith tiers, and npm provenance comes
//! from a GitHub-hosted runner.

use regex::Regex;
use yaml_rust2::Yaml;

use crate::support::{jobs, read_yaml, steps, truthy, workflow_files};

/// npm trusted publishing creates provenance only on GitHub-hosted runners.
const PROVENANCE_PUBLISH_RUNNER: &str = "ubuntu-24.04";
/// CI's Windows native job compiles and tests the whole Rust workspace.
const CI_WINDOWS_NATIVE_RUNNER: &str = "blacksmith-8vcpu-windows-2025";
/// Workflows whose native build matrix may run `darwin-x64` on Intel macOS.
const INTEL_MACOS_WORKFLOWS: [&str; 3] =
    ["release.yml", "release-check.yml", "native-bootstrap.yml"];

#[test]
fn workflows_use_the_smallest_blacksmith_tiers_and_publish_to_npm_from_github_hosted_runners() {
    let files = workflow_files();
    assert!(!files.is_empty());
    let matrix_reference = Regex::new(r"^\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}$").unwrap();
    let mut provenance_publishers = Vec::new();
    for file in files {
        let workflow = read_yaml(&file);
        let workflow_name = file.trim_start_matches(".github/workflows/");
        assert!(
            truthy(&workflow["jobs"]),
            "{workflow_name} must define jobs"
        );
        for (job_name, job) in jobs(&workflow) {
            let context = format!("{workflow_name}:{job_name}");
            if truthy(&job["uses"]) {
                assert_eq!(context, "release.yml:prepare-release");
                assert_eq!(
                    job["uses"].as_str(),
                    Some("./.github/workflows/release-prepare.yml")
                );
                continue;
            }
            let runs_on = job["runs-on"]
                .as_str()
                .unwrap_or_else(|| panic!("{context} runner"));
            if context == "design-attribution.yml:design-attribution" {
                assert_eq!(runs_on, "blacksmith-8vcpu-ubuntu-2404");
                continue;
            }
            if publishes_with_provenance(job) {
                assert_eq!(
                    runs_on, PROVENANCE_PUBLISH_RUNNER,
                    "{context} must publish from a GitHub-hosted runner"
                );
                provenance_publishers.push(context);
                continue;
            }
            let Some(reference) = matrix_reference.captures(runs_on) else {
                assert_minimum_runner(runs_on, &context);
                continue;
            };
            let key = &reference[1];
            let matrix = &job["strategy"]["matrix"];
            let values: Vec<&Yaml> = match &matrix[key] {
                Yaml::BadValue | Yaml::Null => matrix["include"]
                    .as_vec()
                    .unwrap_or_else(|| panic!("{context} runner matrix"))
                    .iter()
                    .map(|row| &row[key])
                    .collect(),
                values => values
                    .as_vec()
                    .unwrap_or_else(|| panic!("{context} runner matrix"))
                    .iter()
                    .collect(),
            };
            for value in values {
                let label = value
                    .as_str()
                    .unwrap_or_else(|| panic!("{context} runner matrix value"));
                if INTEL_MACOS_WORKFLOWS.contains(&workflow_name)
                    && job_name == "build-native"
                    && label == "macos-26-intel"
                {
                    let targets: Vec<&Yaml> = matrix["include"]
                        .as_vec()
                        .expect("the Intel macOS runner comes from include rows")
                        .iter()
                        .filter(|row| row[key].as_str() == Some(label))
                        .map(|row| &row["target"])
                        .collect();
                    assert_eq!(targets, [&Yaml::String("darwin-x64".to_owned())]);
                } else if context == "ci.yml:native" && label.ends_with("-windows-2025") {
                    assert_eq!(label, CI_WINDOWS_NATIVE_RUNNER);
                } else {
                    assert_minimum_runner(label, &context);
                }
            }
        }
    }
    assert_eq!(provenance_publishers, ["release.yml:publish"]);
}

/// A job that publishes to npm with an OIDC token.
fn publishes_with_provenance(job: &Yaml) -> bool {
    let publish = Regex::new(r"\bnpm publish\b").unwrap();
    job["permissions"]["id-token"].as_str() == Some("write")
        && steps(job)
            .iter()
            .any(|step| publish.is_match(step["run"].as_str().unwrap_or_default()))
}

/// A sized Blacksmith label with the smallest size for its platform.
fn assert_minimum_runner(label: &str, context: &str) {
    let size = Regex::new(r"^blacksmith-([0-9]+)vcpu-(.+)$")
        .unwrap()
        .captures(label)
        .unwrap_or_else(|| panic!("{context} must use a sized Blacksmith runner"));
    let expected = if size[2].starts_with("macos-") { 6 } else { 2 };
    assert_eq!(
        size[1].parse::<u64>().unwrap(),
        expected,
        "{context} must use the smallest {} runner",
        &size[2]
    );
}
