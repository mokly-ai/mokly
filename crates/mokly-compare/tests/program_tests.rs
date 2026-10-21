//! Relative PATH entries cannot run npm from historical source directories.

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[cfg(unix)]
#[test]
fn relative_path_probe() {
    if std::env::var_os("MOKLY_NPM_PATH_PROBE").is_none() {
        return;
    }
    let temporary = tempfile::tempdir().unwrap();
    let executable = temporary.path().join("npm");
    std::fs::write(&executable, b"#!/bin/sh\nprintf history-npm\n").unwrap();
    std::fs::set_permissions(
        &executable,
        std::os::unix::fs::PermissionsExt::from_mode(0o755),
    )
    .unwrap();
    let spawner: &dyn mokly_compare::commands::Spawner = &mokly_compare::process::SystemSpawner {
        groups: std::sync::Arc::new(mokly_platform::processes::SystemProcessGroups),
    };
    let result = spawner.spawn(&mokly_compare::commands::Command {
        program: "npm".into(),
        args: vec!["--version".into()],
        directory: temporary.path().to_owned(),
        timeout: std::time::Duration::from_secs(120),
        byte_limit: None,
        size_root: None,
        cache: None,
    });
    assert!(matches!(
        result,
        Err(mokly_compare::error::Error::CommandUnavailable)
    ));
}

#[cfg(unix)]
#[test]
fn an_npm_in_the_source_directory_is_not_a_package_manager() {
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "relative_path_probe", "--nocapture"])
        .env("MOKLY_NPM_PATH_PROBE", "1")
        .env("PATH", ".")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
}

#[cfg(unix)]
#[test]
fn interpreter_probe() {
    let Some(tools) = std::env::var_os("MOKLY_NPM_INTERPRETER_PROBE") else {
        return;
    };
    let temporary = tempfile::tempdir().unwrap();
    let node = temporary.path().join("node");
    std::fs::write(&node, b"#!/bin/sh\nprintf history-node\n").unwrap();
    std::fs::set_permissions(node, std::fs::Permissions::from_mode(0o755)).unwrap();
    let spawner: &dyn mokly_compare::commands::Spawner = &mokly_compare::process::SystemSpawner {
        groups: std::sync::Arc::new(mokly_platform::processes::SystemProcessGroups),
    };
    let mut child = spawner
        .spawn(&mokly_compare::commands::Command {
            program: "npm".into(),
            args: vec!["--version".into()],
            directory: temporary.path().to_owned(),
            timeout: std::time::Duration::from_secs(120),
            byte_limit: None,
            size_root: None,
            cache: None,
        })
        .unwrap();
    assert_eq!(child.finish().unwrap().stdout, b"trusted-node");
    assert!(std::path::Path::new(&tools).is_absolute());
}

#[cfg(unix)]
#[test]
fn npm_interpreters_also_ignore_relative_path_entries() {
    let tools = tempfile::tempdir().unwrap();
    for (name, script) in [
        ("npm", b"#!/usr/bin/env node\n".as_slice()),
        ("node", b"#!/bin/sh\nprintf trusted-node\n"),
    ] {
        let path = tools.path().join(name);
        std::fs::write(&path, script).unwrap();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
    }
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "interpreter_probe", "--nocapture"])
        .env("MOKLY_NPM_INTERPRETER_PROBE", tools.path())
        .env("PATH", format!(".:{}", tools.path().display()))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
}

#[cfg(unix)]
#[test]
fn install_environment_removes_mokly_token() {
    let Some(_) = std::env::var_os("MOKLY_ENV_PROBE") else {
        return;
    };
    let executable = std::path::PathBuf::from(std::env::var_os("MOKLY_ENV_PROBE_PATH").unwrap());
    let temporary = executable.parent().unwrap();
    let spawner: &dyn mokly_compare::commands::Spawner = &mokly_compare::process::SystemSpawner {
        groups: std::sync::Arc::new(mokly_platform::processes::SystemProcessGroups),
    };
    let mut child = spawner
        .spawn(&mokly_compare::commands::Command {
            program: "npm".into(),
            args: vec!["--version".into()],
            directory: temporary.to_owned(),
            timeout: std::time::Duration::from_secs(120),
            byte_limit: None,
            size_root: None,
            cache: None,
        })
        .unwrap();
    assert_eq!(child.finish().unwrap().stdout, b"unset");
}

#[cfg(unix)]
#[test]
fn environment_probe_runs_with_a_token_and_absolute_manager_path() {
    let temporary = tempfile::tempdir().unwrap();
    let executable = temporary.path().join("npm");
    std::fs::write(
        &executable,
        b"#!/bin/sh\nprintf '%s' \"${MOKLY_TOKEN-unset}\"\n",
    )
    .unwrap();
    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "install_environment_removes_mokly_token",
            "--nocapture",
        ])
        .env("MOKLY_ENV_PROBE", "1")
        .env("MOKLY_TOKEN", "secret")
        .env("PATH", temporary.path())
        .env("MOKLY_ENV_PROBE_PATH", temporary.path().join("npm"))
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}
