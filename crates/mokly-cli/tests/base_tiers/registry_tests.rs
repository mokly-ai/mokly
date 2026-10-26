//! A cold base installs from its configured registry with the user's credentials.

use std::fs;
use std::path::Path;

use super::managers::{MANAGERS, Manager};
use super::probe::read;
use super::registry_fixture::registry_base;
use super::support::{Host, build};

fn installs_from_the_registry(manager: &Manager, host: Host) {
    let fixture = registry_base(manager, None);
    let cold = &fixture.cold;
    let (built, finished) = build(&cold.root, &cold.env, &fixture.removed, None, host);
    assert_eq!(
        built.tier,
        Some(2),
        "{}\n{}",
        finished.stderr,
        read(&fixture.probe.output)
    );
    assert!(!finished.stderr.contains("base dependencies"));
    assert_eq!(read(&fixture.probe.network), "");
    let requests = fixture.registry.requests();
    let tarball = "/mokly-cold-dependency/-/mokly-cold-dependency-1.0.0.tgz";
    assert!(
        requests
            .iter()
            .any(|request| request.path == tarball && request.authorized),
        "{requests:?}"
    );
    assert!(
        requests.iter().all(|request| request.authorized),
        "{requests:?}"
    );
    let entries = Path::new(&built.namespace).join("dependencies/entries");
    let key = fs::read_dir(&entries)
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    let installed = key.join("data");
    let index_js =
        fs::read_to_string(installed.join("node_modules/mokly-cold-dependency/index.js")).unwrap();
    assert!(index_js.contains("Base dependency"));
    for relative in [
        "lifecycle-ran",
        "node_modules/mokly-cold-dependency/lifecycle-ran",
    ] {
        assert!(!installed.join(relative).exists(), "{relative}");
    }
    let calls = read(&fixture.probe.calls);
    assert_eq!(calls.trim().split('\n').count(), 1, "{calls}");
}

#[test]
fn a_cold_pnpm_base_installs_from_its_configured_registry_with_user_credentials() {
    installs_from_the_registry(&MANAGERS[0], Host::Local);
    installs_from_the_registry(&MANAGERS[0], Host::Hosted);
}

#[test]
fn a_cold_yarn_classic_base_installs_from_its_configured_registry_with_user_credentials() {
    installs_from_the_registry(&MANAGERS[1], Host::Local);
    installs_from_the_registry(&MANAGERS[1], Host::Hosted);
}

#[test]
fn a_cold_yarn_berry_base_installs_from_its_configured_registry_with_user_credentials() {
    installs_from_the_registry(&MANAGERS[2], Host::Local);
    installs_from_the_registry(&MANAGERS[2], Host::Hosted);
}

#[test]
fn a_cold_pnpm_11_base_installs_from_its_configured_registry_with_user_credentials() {
    installs_from_the_registry(&MANAGERS[3], Host::Local);
    installs_from_the_registry(&MANAGERS[3], Host::Hosted);
}

#[test]
fn a_cold_pnpm_12_base_installs_from_its_configured_registry_with_user_credentials() {
    installs_from_the_registry(&MANAGERS[4], Host::Local);
    installs_from_the_registry(&MANAGERS[4], Host::Hosted);
}
