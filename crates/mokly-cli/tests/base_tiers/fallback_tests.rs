//! A base falls back to working dependencies with a reason, or keeps tier two safely.

use std::path::Path;

use mokly_test_support::files::write;

use super::cold::cold_base;
use super::manager_fixture::{Mode, manager_base};
use super::managers::{MANAGERS, Manager};
use super::probe::read;
use super::support::{Host, absent, build, children};

fn warns_when_the_manager_is(manager: &Manager, mode: Mode, reason: &str, host: Host) {
    let fixture = manager_base(manager, mode);
    let cold = &fixture.cold;
    let (built, _) = build(
        &cold.root,
        &cold.env,
        &[],
        Some(&fixture.probe.network),
        host,
    );
    assert_eq!(built.tier, Some(3));
    assert!(built.diagnostics.contains("base dependencies at"));
    assert!(built.diagnostics.contains(reason), "{}", built.diagnostics);
    assert_eq!(read(&fixture.probe.calls), "");
}

fn falls_back_without_a_manager_call(mode: Mode, reason: &str, host: Host) {
    let fixture = manager_base(&MANAGERS[2], mode);
    let cold = &fixture.cold;
    let (built, _) = build(
        &cold.root,
        &cold.env,
        &[],
        Some(&fixture.probe.network),
        host,
    );
    assert_eq!(built.tier, Some(3));
    assert!(built.diagnostics.contains(reason), "{}", built.diagnostics);
    assert_eq!(read(&fixture.probe.calls), "");
    absent(&cold.root.join("historical-exec-ran"));
}

fn constraints_stay_disabled(host: Host) {
    let fixture = manager_base(&MANAGERS[2], Mode::Constraints);
    let cold = &fixture.cold;
    let (built, _) = build(
        &cold.root,
        &cold.env,
        &[],
        Some(&fixture.probe.network),
        host,
    );
    assert_eq!(built.tier, Some(2), "{}", built.diagnostics);
    assert_eq!(built.diagnostics, "");
    absent(&cold.root.join("historical-constraints-ran"));
}

const MISSING: &str = "package manager or lockfile unavailable";
const VERSION: &str = "package manager version unsupported";

#[test]
fn a_cold_pnpm_base_warns_when_its_manager_is_missing() {
    warns_when_the_manager_is(&MANAGERS[0], Mode::Missing, MISSING, Host::Local);
    warns_when_the_manager_is(&MANAGERS[0], Mode::Missing, MISSING, Host::Hosted);
}

#[test]
fn a_cold_pnpm_base_warns_when_its_manager_is_version() {
    warns_when_the_manager_is(&MANAGERS[0], Mode::Version, VERSION, Host::Local);
    warns_when_the_manager_is(&MANAGERS[0], Mode::Version, VERSION, Host::Hosted);
}

#[test]
fn a_cold_yarn_classic_base_warns_when_its_manager_is_missing() {
    warns_when_the_manager_is(&MANAGERS[1], Mode::Missing, MISSING, Host::Local);
    warns_when_the_manager_is(&MANAGERS[1], Mode::Missing, MISSING, Host::Hosted);
}

#[test]
fn a_cold_yarn_classic_base_warns_when_its_manager_is_version() {
    warns_when_the_manager_is(&MANAGERS[1], Mode::Version, VERSION, Host::Local);
    warns_when_the_manager_is(&MANAGERS[1], Mode::Version, VERSION, Host::Hosted);
}

#[test]
fn a_cold_yarn_plug_n_play_base_gives_its_resolver_fallback_reason() {
    for host in [Host::Local, Host::Hosted] {
        falls_back_without_a_manager_call(Mode::Pnp, "Yarn Plug'n'Play is unsupported", host);
    }
}

#[test]
fn a_cold_yarn_berry_base_with_exec_dependencies_falls_back_without_running_the_generator() {
    for host in [Host::Local, Host::Hosted] {
        falls_back_without_a_manager_call(Mode::Exec, "invalid dependency input", host);
    }
}

#[test]
fn a_cold_yarn_berry_base_disables_constraints_code_from_the_historical_tree() {
    constraints_stay_disabled(Host::Local);
    constraints_stay_disabled(Host::Hosted);
}

fn keeps_install_paths_private(manager: &Manager, host: Host) {
    let fixture = manager_base(manager, Mode::Paths);
    let cold = &fixture.cold;
    let (built, _) = build(
        &cold.root,
        &cold.env,
        &[],
        Some(&fixture.probe.network),
        host,
    );
    assert_eq!(built.tier, Some(2), "{}", built.diagnostics);
    assert_eq!(built.diagnostics, "");
    let entries = Path::new(&built.namespace).join("dependencies/entries");
    let keys = children(&entries);
    assert_eq!(keys.len(), 1);
    assert_eq!(children(&entries.join(&keys[0])), ["data", "receipt.json"]);
}

#[test]
fn a_pnpm_base_keeps_configured_install_paths_inside_its_private_entry() {
    keeps_install_paths_private(&MANAGERS[0], Host::Local);
    keeps_install_paths_private(&MANAGERS[0], Host::Hosted);
}

#[test]
fn a_pnpm_11_base_keeps_configured_install_paths_inside_its_private_entry() {
    keeps_install_paths_private(&MANAGERS[3], Host::Local);
    keeps_install_paths_private(&MANAGERS[3], Host::Hosted);
}

#[test]
fn a_pnpm_12_base_keeps_configured_install_paths_inside_its_private_entry() {
    keeps_install_paths_private(&MANAGERS[4], Host::Local);
    keeps_install_paths_private(&MANAGERS[4], Host::Hosted);
}

#[test]
fn npm_only_configuration_edits_keep_the_existing_equal_identity_tier() {
    for host in [Host::Local, Host::Hosted] {
        let cold = cold_base(1);
        write(
            &cold.root,
            ".npmrc",
            "offline=true\n# working configuration comment\n",
        );
        let (built, _) = build(&cold.root, &cold.env, &[], None, host);
        assert_eq!(built.tier, Some(1), "{}", built.diagnostics);
        assert_eq!(built.diagnostics, "");
    }
}
