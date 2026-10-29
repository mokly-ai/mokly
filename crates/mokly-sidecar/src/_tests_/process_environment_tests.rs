//! Sidecar command environment policy tests.

use std::collections::BTreeMap;
use std::ffi::{OsStr, OsString};
use std::path::Path;
use std::process::Command;

use super::apply;

fn configured(command: &Command) -> BTreeMap<OsString, Option<OsString>> {
    command
        .get_envs()
        .map(|(name, value)| (name.to_os_string(), value.map(OsStr::to_os_string)))
        .collect()
}

#[test]
fn removes_inherited_mokly_values_and_keeps_other_environment() {
    let mut command = Command::new("node");
    for (name, value) in [
        ("MOKLY_TOKEN", "token"),
        ("MOKLY_ENDPOINT", "endpoint"),
        ("MOKLY_TEST_X", "test"),
        ("MOKLY_POSTCSS_PHASES", "0"),
        ("PATH", "path"),
        ("NODE_ENV", "test"),
        ("NODE_OPTIONS", "options"),
        ("MOKLYTOKEN", "prefix-near-miss"),
        ("XMOKLY_TOKEN", "prefix-near-miss"),
        ("mokly_token", "lowercase"),
        ("Mokly_Endpoint", "mixed-case"),
        ("INIT_CWD", "init"),
        ("npm_package_json", "package"),
        ("npm_config_local_prefix", "prefix"),
    ] {
        command.env(name, value);
    }
    let inherited = command
        .get_envs()
        .map(|(name, _)| name.to_os_string())
        .collect::<Vec<_>>();

    apply(&mut command, inherited, Path::new("/repository"), false);
    let values = configured(&command);
    for name in [
        "MOKLY_TOKEN",
        "MOKLY_ENDPOINT",
        "MOKLY_TEST_X",
        "INIT_CWD",
        "npm_package_json",
        "npm_config_local_prefix",
    ] {
        assert!(
            values.get(OsStr::new(name)).is_some_and(Option::is_none),
            "{name}"
        );
    }
    for (name, value) in [
        ("PATH", "path"),
        ("NODE_ENV", "test"),
        ("NODE_OPTIONS", "options"),
        ("MOKLYTOKEN", "prefix-near-miss"),
        ("XMOKLY_TOKEN", "prefix-near-miss"),
        ("mokly_token", "lowercase"),
        ("Mokly_Endpoint", "mixed-case"),
    ] {
        assert_eq!(
            values.get(OsStr::new(name)),
            Some(&Some(OsString::from(value)))
        );
    }
    assert_eq!(
        values.get(OsStr::new("PWD")),
        Some(&Some(OsString::from("/repository")))
    );
    assert_eq!(
        values.get(OsStr::new("MOKLY_POSTCSS_PHASES")),
        Some(&Some(OsString::from("1")))
    );
}

#[test]
fn windows_prefix_matching_is_ascii_case_insensitive() {
    let mut command = Command::new("node");
    for (name, value) in [("mokly_token", "token"), ("Mokly_Endpoint", "endpoint")] {
        command.env(name, value);
    }
    let inherited = command
        .get_envs()
        .map(|(name, _)| name.to_os_string())
        .collect::<Vec<_>>();
    apply(&mut command, inherited, Path::new("/repository"), true);
    let values = configured(&command);
    assert!(
        values
            .get(OsStr::new("mokly_token"))
            .is_some_and(Option::is_none)
    );
    assert!(
        values
            .get(OsStr::new("Mokly_Endpoint"))
            .is_some_and(Option::is_none)
    );
}
