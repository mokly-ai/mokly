//! Every automation npm pin matches the `packageManager` version.

use std::cmp::Ordering;

use regex::Regex;

use crate::support::{action_manifests, jobs, read_text, read_yaml, steps, workflow_files};

/// The first npm release that writes lockfile `libc` fields (npm/cli#9025).
const FIRST_NPM_WITH_LOCKFILE_LIBC: &str = "11.11.0";
/// Workflows whose dependency installs must use the pinned npm.
const PINNED_WORKFLOWS: [&str; 3] = ["ci.yml", "release.yml", "release-prepare.yml"];

#[test]
fn every_automation_npm_pin_matches_the_package_manager_version() {
    let pinned = pinned_npm_version();
    let pin = Regex::new(r"npm (?:install|i) (?:--global|-g) npm@(\S+)").unwrap();
    let mut pins = Vec::new();
    for file in workflow_files().into_iter().chain(action_manifests()) {
        let source = read_text(&file);
        for version in pin.captures_iter(&source) {
            pins.push((file.clone(), version[1].to_owned()));
        }
    }
    assert!(!pins.is_empty(), "workflows must pin npm");
    for (file, version) in pins {
        assert_eq!(version, pinned, "{file}");
    }
}

#[test]
fn ci_and_release_jobs_set_up_the_pinned_npm_before_npm_ci() {
    let pinned = pinned_npm_version();
    let setup_command = format!("npm install --global npm@{pinned}");
    let mut installs = 0;
    for file in PINNED_WORKFLOWS {
        let workflow = read_yaml(&format!(".github/workflows/{file}"));
        for (name, job) in jobs(&workflow) {
            let job_steps = steps(job);
            let Some(install) = job_steps
                .iter()
                .position(|step| step["run"].as_str() == Some("npm ci"))
            else {
                continue;
            };
            installs += 1;
            let setup = job_steps
                .iter()
                .position(|step| step["run"].as_str() == Some(setup_command.as_str()));
            assert!(
                setup.is_some_and(|setup| setup < install),
                "{file}:{name} must set up npm {pinned} before npm ci"
            );
        }
    }
    assert!(
        installs > 0,
        "CI and release workflows must install dependencies"
    );
}

#[test]
fn the_pinned_npm_is_new_enough_to_keep_lockfile_libc_fields() {
    let pinned = pinned_npm_version();
    assert_ne!(
        compare_versions(&pinned, FIRST_NPM_WITH_LOCKFILE_LIBC),
        Ordering::Less,
        "npm {pinned} drops lockfile libc fields; pin npm {FIRST_NPM_WITH_LOCKFILE_LIBC} or newer"
    );
}

/// The exact npm version that `packageManager` pins.
fn pinned_npm_version() -> String {
    let manifest: serde_json::Value = serde_json::from_str(&read_text("package.json")).unwrap();
    let package_manager = manifest["packageManager"].as_str().unwrap_or_default();
    Regex::new(r"^npm@([0-9]+\.[0-9]+\.[0-9]+)$")
        .unwrap()
        .captures(package_manager)
        .map(|version| version[1].to_owned())
        .expect("packageManager must pin an exact npm version")
}

/// Compare the three numeric parts of two versions.
fn compare_versions(left: &str, right: &str) -> Ordering {
    let parts = |version: &str| -> Vec<u64> {
        version
            .split('.')
            .map(|part| part.parse().unwrap_or_default())
            .collect()
    };
    let (left, right) = (parts(left), parts(right));
    (0..3)
        .map(|index| {
            let left = left.get(index).copied().unwrap_or_default();
            let right = right.get(index).copied().unwrap_or_default();
            left.cmp(&right)
        })
        .find(|order| order.is_ne())
        .unwrap_or(Ordering::Equal)
}
