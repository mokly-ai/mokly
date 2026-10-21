//! pnpm and Yarn inherit npm's parent-side executable and interpreter rules.

#![cfg(unix)]

use std::env;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::process;
use std::sync::Arc;
use std::time::Duration;

use mokly_compare::commands::{Command, Spawner};
use mokly_compare::error::Error;
use mokly_compare::process::SystemSpawner;
use mokly_platform::processes::SystemProcessGroups;

#[test]
fn manager_path_probe() {
    let Some(manager) = env::var_os("MOKLY_MANAGER_PATH_PROBE") else {
        return;
    };
    let source = tempfile::tempdir().unwrap();
    for (name, bytes) in [
        (
            manager.clone(),
            b"#!/bin/sh\nprintf historical-manager".as_slice(),
        ),
        ("node".into(), b"#!/bin/sh\nprintf historical-node"),
    ] {
        let file = source.path().join(name);
        fs::write(&file, bytes).unwrap();
        fs::set_permissions(file, fs::Permissions::from_mode(0o755)).unwrap();
    }
    let spawner: &dyn Spawner = &SystemSpawner {
        groups: Arc::new(SystemProcessGroups),
    };
    let request = Command {
        program: manager,
        args: vec!["--version".into()],
        directory: source.path().to_owned(),
        timeout: Duration::from_secs(120),
        byte_limit: None,
        size_root: None,
        berry_cache: None,
    };
    if env::var_os("MOKLY_MANAGER_INTERPRETER_PROBE").is_some() {
        assert_eq!(
            spawner.spawn(&request).unwrap().finish().unwrap().stdout,
            b"trusted-node"
        );
    } else {
        assert!(matches!(
            spawner.spawn(&request),
            Err(Error::CommandUnavailable)
        ));
    }
}

#[test]
fn pnpm_and_yarn_exclude_relative_executable_and_interpreter_paths() {
    for manager in ["pnpm", "yarn"] {
        let tools = tempfile::tempdir().unwrap();
        for (name, script) in [
            (manager, b"#!/usr/bin/env node\n".as_slice()),
            ("node", b"#!/bin/sh\nprintf trusted-node\n"),
        ] {
            let file = tools.path().join(name);
            fs::write(&file, script).unwrap();
            fs::set_permissions(file, fs::Permissions::from_mode(0o755)).unwrap();
        }
        for interpreter in [false, true] {
            let mut command = process::Command::new(env::current_exe().unwrap());
            command
                .args(["--exact", "manager_path_probe", "--nocapture"])
                .env("MOKLY_MANAGER_PATH_PROBE", manager);
            if interpreter {
                command
                    .env("MOKLY_MANAGER_INTERPRETER_PROBE", "1")
                    .env("PATH", format!(".:{}", tools.path().display()));
            } else {
                command.env("PATH", ".");
            }
            let output = command.output().unwrap();
            assert!(
                output.status.success(),
                "{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }
}
