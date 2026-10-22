//! Node probes cannot execute files from a historical relative PATH entry.

#[cfg(unix)]
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(unix)]
use std::process;
#[cfg(unix)]
use std::sync::Arc;
#[cfg(unix)]
use std::time::Duration;

#[cfg(unix)]
use mokly_compare::commands::{Command, Spawner};
#[cfg(unix)]
use mokly_compare::error::Error;
#[cfg(unix)]
use mokly_compare::node_executable::{NodeExecutable, SystemNodeExecutable};
#[cfg(unix)]
use mokly_compare::process::SystemSpawner;
#[cfg(unix)]
use mokly_platform::processes::SystemProcessGroups;

#[cfg(unix)]
#[test]
fn relative_node_probe() {
    if std::env::var_os("MOKLY_RELATIVE_NODE_PROBE").is_none() {
        return;
    }
    let base = tempfile::tempdir().unwrap();
    let node = base.path().join("node");
    fs::write(&node, "#!/bin/sh\nprintf historical-node\n").unwrap();
    fs::set_permissions(node, fs::Permissions::from_mode(0o755)).unwrap();
    let spawner: &dyn Spawner = &SystemSpawner {
        groups: Arc::new(SystemProcessGroups),
    };
    let result = spawner.spawn(&Command {
        program: "node".into(),
        args: vec!["--version".into()],
        directory: base.path().into(),
        timeout: Duration::from_secs(120),
        byte_limit: None,
        size_root: None,
        cache: None,
        node: None,
    });
    let unavailable = match result {
        Err(Error::CommandUnavailable) => true,
        Ok(mut child) => {
            child.finish().unwrap();
            false
        }
        Err(error) => panic!("{error}"),
    };
    assert!(
        unavailable,
        "a historical node must not run through relative PATH"
    );
}

#[cfg(unix)]
#[test]
fn a_node_probe_ignores_relative_path_entries() {
    let output = process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "relative_node_probe", "--nocapture"])
        .env("MOKLY_RELATIVE_NODE_PROBE", "1")
        .env_remove("MOKLY_NODE_EXECUTABLE")
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
fn selected_node_probe() {
    let Some(root) = std::env::var_os("MOKLY_SELECTED_NODE_PROBE") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let node = SystemNodeExecutable.resolve().unwrap();
    assert_eq!(node, root.join("selected/node"));
    let spawner: &dyn Spawner = &SystemSpawner {
        groups: Arc::new(SystemProcessGroups),
    };
    for (program, pinned, expected) in [
        ("node", None, "selected-node"),
        ("npm", None, "path-node"),
        ("npm", Some(node), "selected-node"),
    ] {
        let mut child = spawner
            .spawn(&Command {
                program: program.into(),
                args: vec!["--version".into()],
                directory: root.clone(),
                timeout: Duration::from_secs(120),
                byte_limit: None,
                size_root: None,
                cache: None,
                node: pinned,
            })
            .unwrap();
        assert_eq!(child.finish().unwrap().stdout, expected.as_bytes());
    }
}

#[cfg(unix)]
#[test]
fn installs_pin_the_probed_node_without_changing_the_manager() {
    let temporary = tempfile::tempdir().unwrap();
    for (name, script) in [
        ("path/npm", "#!/usr/bin/env node\n"),
        ("path/node", "#!/bin/sh\nprintf path-node\n"),
        ("selected/node", "#!/bin/sh\nprintf selected-node\n"),
        ("selected/npm", "#!/bin/sh\nprintf wrong-manager\n"),
        ("node", "#!/bin/sh\nprintf historical-node\n"),
    ] {
        let file = temporary.path().join(name);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, script).unwrap();
        fs::set_permissions(file, fs::Permissions::from_mode(0o755)).unwrap();
    }
    let output = process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "selected_node_probe", "--nocapture"])
        .env("MOKLY_SELECTED_NODE_PROBE", temporary.path())
        .env(
            "MOKLY_NODE_EXECUTABLE",
            temporary.path().join("selected/node"),
        )
        .env(
            "PATH",
            format!(".:{}", temporary.path().join("path").display()),
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
