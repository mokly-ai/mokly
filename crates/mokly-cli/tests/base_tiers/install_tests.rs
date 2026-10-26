//! Each pinned manager installs a cold base offline without scripts and reuses its cache.

use std::fs;
use std::path::Path;

use mokly_test_support::readers;
use serde_json::json;

use super::manager_fixture::{Mode, manager_base};
use super::managers::{MANAGERS, Manager};
use super::probe::read;
use super::support::{Host, absent, build};

fn installs_offline_and_reuses_its_cache(manager: &Manager, host: Host) {
    let fixture = manager_base(manager, Mode::Installed);
    let cold = &fixture.cold;
    let probe = &fixture.probe;
    assert_eq!(fs::read_dir(&cold.cache).unwrap().count(), 0);
    let (first, _) = build(&cold.root, &cold.env, &[], Some(&probe.network), host);
    assert_eq!(
        first.tier,
        Some(2),
        "{}\n{}",
        first.diagnostics,
        read(&probe.output)
    );
    assert_eq!(first.diagnostics, "");
    let output = cold.root.join(".context/site");
    let index = readers::index(&fs::read(output.join("mokly-viewer/index.json")).unwrap());
    assert_eq!(index["changesStatus"], "ready");
    let comparison_url = index["comparisonUrl"].as_str().expect("a comparison URL");
    let review = readers::review(&fs::read(output.join(comparison_url)).unwrap());
    assert_eq!(review["baseCommit"], cold.base.as_str());
    for (name, kind, included) in [
        ("welcome", "unmodified", false),
        ("dependency", "changed", true),
        ("workspace", "changed", true),
    ] {
        let page = index["pages"]
            .as_array()
            .unwrap()
            .iter()
            .find(|page| page["path"] == name)
            .unwrap();
        assert_eq!(
            page["changes"],
            json!({ "status": "ready", "kind": kind, "included": included })
        );
    }
    let entries = Path::new(&first.namespace).join("dependencies/entries");
    let keys: Vec<_> = fs::read_dir(&entries).unwrap().collect();
    assert_eq!(keys.len(), 1);
    let installed = keys[0].as_ref().unwrap().path().join("data");
    let index_js =
        fs::read_to_string(installed.join("node_modules/mokly-cold-dependency/index.js")).unwrap();
    assert!(index_js.contains("Base dependency"));
    for relative in [
        "lifecycle-ran",
        "node_modules/mokly-cold-dependency/lifecycle-ran",
        "packages/local/lifecycle-ran",
    ] {
        absent(&installed.join(relative));
        absent(&cold.root.join(relative));
    }
    fs::write(installed.join("cache-reuse-sentinel"), "keep").unwrap();
    let calls = read(&probe.calls);
    assert_ne!(calls, "");
    assert_eq!(calls.trim().split('\n').count(), 1, "{calls}");
    let (second, _) = build(&cold.root, &cold.env, &[], Some(&probe.network), host);
    assert_eq!(second, first);
    assert_eq!(read(&probe.calls), calls);
    assert_eq!(
        fs::read_to_string(installed.join("cache-reuse-sentinel")).unwrap(),
        "keep"
    );
}

#[test]
fn a_cold_pnpm_base_installs_offline_without_scripts_and_reuses_its_dependency_cache() {
    installs_offline_and_reuses_its_cache(&MANAGERS[0], Host::Local);
}

#[test]
fn a_cold_pnpm_base_installs_offline_with_hosted_ci_defaults() {
    installs_offline_and_reuses_its_cache(&MANAGERS[0], Host::Hosted);
}

#[test]
fn a_cold_yarn_classic_base_installs_offline_without_scripts_and_reuses_its_dependency_cache() {
    installs_offline_and_reuses_its_cache(&MANAGERS[1], Host::Local);
}

#[test]
fn a_cold_yarn_classic_base_installs_offline_with_hosted_ci_defaults() {
    installs_offline_and_reuses_its_cache(&MANAGERS[1], Host::Hosted);
}

#[test]
fn a_cold_yarn_berry_base_installs_offline_without_scripts_and_reuses_its_dependency_cache() {
    installs_offline_and_reuses_its_cache(&MANAGERS[2], Host::Local);
}

#[test]
fn a_cold_yarn_berry_base_installs_offline_with_hosted_ci_defaults() {
    installs_offline_and_reuses_its_cache(&MANAGERS[2], Host::Hosted);
}

#[test]
fn a_cold_pnpm_11_base_installs_offline_without_scripts_and_reuses_its_dependency_cache() {
    installs_offline_and_reuses_its_cache(&MANAGERS[3], Host::Local);
}

#[test]
fn a_cold_pnpm_11_base_installs_offline_with_hosted_ci_defaults() {
    installs_offline_and_reuses_its_cache(&MANAGERS[3], Host::Hosted);
}

#[test]
fn a_cold_pnpm_12_base_installs_offline_without_scripts_and_reuses_its_dependency_cache() {
    installs_offline_and_reuses_its_cache(&MANAGERS[4], Host::Local);
}

#[test]
fn a_cold_pnpm_12_base_installs_offline_with_hosted_ci_defaults() {
    installs_offline_and_reuses_its_cache(&MANAGERS[4], Host::Hosted);
}
