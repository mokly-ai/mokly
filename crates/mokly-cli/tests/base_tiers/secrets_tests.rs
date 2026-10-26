//! A base configuration cannot send inherited secrets or outside environment files to a registry.

use mokly_test_support::process::Finished;

use super::managers::{MANAGERS, Manager};
use super::probe::read;
use super::registry_fixture::{Attack, RegistryBase, registry_base};
use super::support::command;

fn attacked(manager: &Manager, attack: &Attack) -> (Finished, RegistryBase) {
    let fixture = registry_base(manager, Some(attack));
    let cold = &fixture.cold;
    let result = command(
        &cold.root,
        &[
            "build",
            "--base=HEAD",
            "--out=.context/site",
            "--sidecars=1",
        ],
        &cold.env,
        &fixture.removed,
        None,
    )
    .run();
    (result, fixture)
}

fn carried(fixture: &RegistryBase, secret: &str) -> bool {
    fixture.registry.requests().iter().any(|request| {
        request
            .authorization
            .as_deref()
            .unwrap_or("")
            .contains(secret)
    })
}

fn cannot_send_an_inherited_github_token(manager: &Manager) {
    let secret = "github-secret-DO-NOT-LEAK";
    let attack = Attack {
        env: vec![
            ("GITHUB_TOKEN", secret.to_owned()),
            (
                "NPM_CONFIG_USERCONFIG",
                "/tmp/mokly-attacker.npmrc".to_owned(),
            ),
        ],
        placeholder: Some("${GITHUB_TOKEN}"),
        secret,
        inject: false,
    };
    let (result, fixture) = attacked(manager, &attack);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(
        !carried(&fixture, secret),
        "{:?}",
        fixture.registry.requests()
    );
    assert_eq!(read(&fixture.probe.network), "");
    assert!(result.stderr.contains("base dependencies"));
}

#[test]
fn a_cold_yarn_classic_base_cannot_send_an_inherited_github_token_to_its_registry() {
    cannot_send_an_inherited_github_token(&MANAGERS[1]);
}

#[test]
fn a_cold_yarn_berry_base_cannot_send_an_inherited_github_token_to_its_registry() {
    cannot_send_an_inherited_github_token(&MANAGERS[2]);
}

#[test]
fn a_cold_yarn_berry_base_reads_an_allowed_lang_variable_in_the_install() {
    let secret = "allowed-lang-sentinel";
    let attack = Attack {
        env: vec![("LANG", format!("en_US.{secret}"))],
        placeholder: Some("${LANG}"),
        secret,
        inject: false,
    };
    let (_, fixture) = attacked(&MANAGERS[2], &attack);
    assert!(
        carried(&fixture, secret),
        "{:?}",
        fixture.registry.requests()
    );
}

#[test]
fn a_cold_yarn_berry_base_cannot_inject_an_outside_environment_file() {
    let secret = "inject-secret-DO-NOT-LEAK";
    let attack = Attack {
        env: Vec::new(),
        placeholder: None,
        secret,
        inject: true,
    };
    let (result, fixture) = attacked(&MANAGERS[2], &attack);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(
        !carried(&fixture, secret),
        "{:?}",
        fixture.registry.requests()
    );
    assert_eq!(read(&fixture.probe.network), "");
    assert!(result.stderr.contains("base dependencies"));
}
