//! Action pins, untrusted input, full history, the checked-out lockfile, and
//! the Testbox toolchain of the GitHub automation.

use std::sync::LazyLock;

use regex::Regex;
use yaml_rust2::Yaml;

use crate::support::{
    all_steps, automation_files, jobs, read_text, read_yaml, repository_root, run_scripts, steps,
};

const CI_WORKFLOW: &str = ".github/workflows/ci.yml";
const TESTBOX_WORKFLOW: &str = ".github/workflows/blacksmith-testbox.yml";
const FULL_HISTORY_WORKFLOWS: [&str; 1] = [CI_WORKFLOW];
const CHECKOUT_ACTIONS: [&str; 2] = ["useblacksmith/checkout@", "actions/checkout@"];
/// A line of a run script that installs the locked npm dependencies.
static INSTALL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?m)^\s*npm ci\b").unwrap());
/// Workflows whose run steps receive every expression through `env`.
const ENV_ONLY_WORKFLOWS: [&str; 2] = [
    ".github/workflows/dependency-audit.yml",
    ".github/workflows/native-bootstrap.yml",
];

#[test]
fn external_actions_pin_commits_and_local_workflows_use_the_caller_revision() {
    let local = Regex::new(r"^\./\.github/workflows/[A-Za-z0-9_-]+\.ya?ml$").unwrap();
    let pinned = Regex::new(r"@[a-f0-9]{40}$").unwrap();
    let mut references = Vec::new();
    for file in automation_files() {
        let document = read_yaml(&file);
        for uses in action_references(&document, &file) {
            if uses.starts_with("./") {
                assert!(local.is_match(uses), "{file}: {uses}");
                assert!(repository_root().join(uses).exists(), "{file}: {uses}");
            } else {
                references.push(format!("{file}: {uses}"));
            }
        }
    }
    assert!(
        !references.is_empty(),
        "workflows and actions must use actions"
    );
    let unpinned: Vec<&String> = references
        .iter()
        .filter(|reference| !pinned.is_match(reference))
        .collect();
    assert!(
        unpinned.is_empty(),
        "pin every uses: reference to a 40-character lowercase commit revision: {unpinned:?}"
    );
}

#[test]
fn run_steps_never_interpolate_untrusted_input() {
    let untrusted =
        Regex::new(r"\$\{\{[^}]*github\.event\.pull_request\.(?:head\.ref|labels)").unwrap();
    let ci = read_yaml(CI_WORKFLOW);
    let ci_runs = run_scripts(&ci);
    assert!(!ci_runs.is_empty(), "ci.yml runs scripts");
    let interpolated: Vec<&&str> = ci_runs
        .iter()
        .filter(|run| untrusted.is_match(run))
        .collect();
    assert!(
        interpolated.is_empty(),
        "pass pull request head refs and labels to ci.yml run steps through env: {interpolated:?}"
    );
    for file in ENV_ONLY_WORKFLOWS {
        let document = read_yaml(file);
        let runs = run_scripts(&document);
        assert!(!runs.is_empty(), "{file} runs scripts");
        let expressions: Vec<&&str> = runs.iter().filter(|run| run.contains("${{")).collect();
        assert!(
            expressions.is_empty(),
            "pass every expression to {file} run steps through env: {expressions:?}"
        );
    }
}

#[test]
fn ci_jobs_that_install_dependencies_check_out_full_history() {
    let mut checked = 0;
    for file in FULL_HISTORY_WORKFLOWS {
        let document = read_yaml(file);
        for (name, job) in jobs(&document) {
            let job_steps = steps(job);
            let checkouts: Vec<&Yaml> = job_steps.iter().filter(|step| is_checkout(step)).collect();
            if checkouts.is_empty() || !job_steps.iter().any(installs_dependencies) {
                continue;
            }
            checked += 1;
            for checkout in checkouts {
                assert_eq!(
                    checkout["with"]["fetch-depth"].as_i64(),
                    Some(0),
                    "{file} job {name} must check out full history with fetch-depth: 0"
                );
            }
        }
    }
    assert!(checked > 0, "CI jobs must install dependencies");
}

#[test]
fn ci_functional_jobs_use_only_the_checked_out_lockfile() {
    let source = read_text(CI_WORKFLOW);
    let document = read_yaml(CI_WORKFLOW);
    let merge_base = Regex::new(r"git merge-base HEAD origin/main").unwrap();
    let baseline =
        Regex::new(r"(?:branch-point|baseline-package-lock|git show [^\n]*package-lock\.json)")
            .unwrap();
    for (name, job) in jobs(&document) {
        let job_steps = steps(job);
        if !job_steps.iter().any(installs_dependencies) {
            continue;
        }
        assert!(
            !job_steps
                .iter()
                .any(|step| step["name"].as_str() == Some("Read baseline dependency lockfile")),
            "{name} must not read a baseline dependency lockfile"
        );
        let commands = job_steps
            .iter()
            .map(|step| step["run"].as_str().unwrap_or_default())
            .collect::<Vec<_>>()
            .join("\n");
        assert!(
            !merge_base.is_match(&commands),
            "{name} must not resolve its cache input from origin/main"
        );
        assert!(
            !baseline.is_match(&commands),
            "{name} must use the checked-out lockfile"
        );
    }
    for reference in ["origin/main", "baseline-package-lock"] {
        assert!(
            !source.contains(reference),
            "ci.yml must not resolve origin/main or read a baseline lockfile"
        );
    }
}

#[test]
fn the_testbox_toolchain_matches_the_ci_toolchain() {
    let ci = read_yaml(CI_WORKFLOW);
    let testbox = read_yaml(TESTBOX_WORKFLOW);
    let testbox_steps = all_steps(&testbox);
    let repository = job_steps_where(&ci, |step| {
        step["name"].as_str() == Some("Run repository verification")
    });
    let native = job_steps_where(&ci, |step| {
        step["run"]
            .as_str()
            .unwrap_or_default()
            .contains("cargo xtask check --suite native")
    });
    let node_version = &one_step(
        testbox_steps.iter().copied(),
        "Set up Node.js",
        TESTBOX_WORKFLOW,
    )["with"]["node-version"];
    assert_eq!(
        node_version,
        &one_step(native, "Set up Node.js", CI_WORKFLOW)["with"]["node-version"]
    );
    assert_eq!(
        node_version.as_str(),
        tested_node_versions().first().map(String::as_str)
    );
    for name in ["Set up npm", "Set up Rust"] {
        let expected = one_step(repository, name, "ci.yml repository job")["run"].as_str();
        assert!(
            expected.is_some_and(|run| !run.is_empty()),
            "the CI repository job's \"{name}\" step runs a script"
        );
        assert_eq!(
            one_step(testbox_steps.iter().copied(), name, TESTBOX_WORKFLOW)["run"].as_str(),
            expected,
            "the Testbox \"{name}\" step must match the CI repository job"
        );
    }
}

/// Every `uses` of the jobs and the steps of a workflow or composite action.
fn action_references<'a>(document: &'a Yaml, file: &str) -> Vec<&'a str> {
    let owners = jobs(document)
        .into_iter()
        .map(|(_, job)| job)
        .chain(all_steps(document));
    owners
        .filter(|owner| !owner["uses"].is_badvalue())
        .map(|owner| {
            owner["uses"]
                .as_str()
                .unwrap_or_else(|| panic!("{file}: each uses: reference is text"))
        })
        .collect()
}

fn is_checkout(step: &Yaml) -> bool {
    let uses = step["uses"].as_str().unwrap_or_default();
    CHECKOUT_ACTIONS
        .iter()
        .any(|action| uses.starts_with(action))
}

fn installs_dependencies(step: &Yaml) -> bool {
    INSTALL.is_match(step["run"].as_str().unwrap_or_default())
}

/// The steps of the first job with a step that matches, or none.
fn job_steps_where(document: &Yaml, matches: impl Fn(&Yaml) -> bool) -> &[Yaml] {
    jobs(document)
        .into_iter()
        .map(|(_, job)| steps(job))
        .find(|job_steps| job_steps.iter().any(&matches))
        .unwrap_or_default()
}

/// The only step with the given name; fails when there is none or several.
fn one_step<'a>(steps: impl IntoIterator<Item = &'a Yaml>, name: &str, owner: &str) -> &'a Yaml {
    let mut matching = steps
        .into_iter()
        .filter(|step| step["name"].as_str() == Some(name));
    let step = matching
        .next()
        .unwrap_or_else(|| panic!("{owner} must have a \"{name}\" step"));
    assert_eq!(matching.count(), 0, "{owner} must have one \"{name}\" step");
    step
}

/// `TESTED_NODE_VERSIONS` of the package's version module, read as text.
fn tested_node_versions() -> Vec<String> {
    let source = read_text("packages/mokly/src/version.mjs");
    let list = Regex::new(r"(?m)^export const TESTED_NODE_VERSIONS = \[([^\]]*)\];$")
        .unwrap()
        .captures(&source)
        .expect("version.mjs exports TESTED_NODE_VERSIONS as a list literal");
    let versions: Vec<String> = Regex::new(r#""([^"]+)""#)
        .unwrap()
        .captures_iter(&list[1])
        .map(|version| version[1].to_owned())
        .collect();
    assert!(!versions.is_empty(), "TESTED_NODE_VERSIONS names a version");
    versions
}
