//! A real interrupt closes an active sidecar before the CLI process finishes.

#![cfg(unix)]

use std::fs;
use std::io::{BufRead, BufReader};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

struct Cleanup {
    child: Child,
    sidecar: Option<String>,
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        let _ = Command::new("kill")
            .args(["-KILL", "--", &format!("-{}", self.child.id())])
            .stderr(Stdio::null())
            .status();
        let _ = self.child.wait();
        if let Some(pid) = &self.sidecar {
            let _ = Command::new("kill")
                .args(["-KILL", pid])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
}

#[test]
fn interrupt_drains_and_stops_a_hung_sidecar() {
    for signal in ["-INT", "-TERM", "-HUP"] {
        interrupt(signal, false);
    }
}

#[test]
fn one_process_group_signal_through_the_shim_drains_the_sidecar() {
    for signal in ["-INT", "-TERM", "-HUP"] {
        interrupt(signal, true);
    }
}

fn interrupt(signal: &str, shim: bool) {
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let directory = tempfile::tempdir().unwrap();
    fs::create_dir(directory.path().join("specs")).unwrap();
    std::os::unix::fs::symlink(
        workspace.join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    fs::write(
        directory.path().join("mokly.config.json"),
        r#"{"roots":[{"dir":"specs"}]}"#,
    )
    .unwrap();
    fs::write(directory.path().join("specs/hang.mockup.ts"), "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'Hang',description:'',relatedDocs:[],props:{},render(){process.stderr.write('fixture-render-ready:'+process.pid+'\\n'); while(true){} }});\n").unwrap();
    let mut command = if shim {
        let mut command = Command::new("node");
        command.arg(install_shim(directory.path(), &workspace));
        command
    } else {
        Command::new(env!("CARGO_BIN_EXE_mokly"))
    };
    let mut child = command
        .process_group(0)
        .args(["build", "--no-changes", "--sidecars", "1"])
        .current_dir(directory.path())
        .env("MOKLY_PACKAGE_ROOT", workspace.join("packages/mokly"))
        .env("MOKLY_OUTPUT", "plain")
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let stderr = child.stderr.take().unwrap();
    let mut cleanup = Cleanup {
        child,
        sidecar: None,
    };
    let (sender, receiver) = mpsc::channel();
    let reader = thread::spawn(move || {
        let mut lines = Vec::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if let Some((_, pid)) = line.split_once("fixture-render-ready:") {
                let _ = sender.send(pid.trim().to_owned());
            }
            lines.push(line);
        }
        lines
    });
    let pid = receiver
        .recv_timeout(Duration::from_secs(30))
        .expect("sidecar render readiness");
    assert!(pid.bytes().all(|byte| byte.is_ascii_digit()));
    cleanup.sidecar = Some(pid.clone());
    assert!(
        Command::new("kill")
            .args([signal, "--", &format!("-{}", cleanup.child.id())])
            .status()
            .unwrap()
            .success()
    );
    assert_eq!(cleanup.child.wait().unwrap().code(), Some(1));
    let lines = reader.join().unwrap();
    assert!(
        lines
            .iter()
            .any(|line| line == "[mokly/build-invalid] build cancelled"),
        "{lines:?}"
    );
    let deadline = Instant::now() + Duration::from_secs(30);
    while Command::new("kill")
        .args(["-0", &pid])
        .stderr(Stdio::null())
        .status()
        .unwrap()
        .success()
    {
        assert!(
            Instant::now() < deadline,
            "sidecar must be killed and reaped after interrupt"
        );
        thread::yield_now();
    }
    cleanup.sidecar = None;
}

fn install_shim(root: &Path, workspace: &Path) -> PathBuf {
    let scope = root.join("installation/node_modules/@mokly");
    fs::create_dir_all(&scope).unwrap();
    std::os::unix::fs::symlink(workspace.join("packages/viewer"), scope.join("viewer")).unwrap();
    let package = scope.join("mokly");
    fs::create_dir_all(package.join("bin")).unwrap();
    fs::create_dir(package.join("dist")).unwrap();
    for file in [
        "package.json",
        "bin/mokly.mjs",
        "dist/runtime.mjs",
        "dist/shim.mjs",
        "dist/platform.mjs",
        "dist/version.mjs",
        "dist/execution.mjs",
    ] {
        fs::copy(
            workspace.join("packages/mokly").join(file),
            package.join(file),
        )
        .unwrap();
    }
    std::os::unix::fs::symlink(
        workspace.join("packages/mokly/dist/sidecar.js"),
        package.join("dist/sidecar.js"),
    )
    .unwrap();
    for entry in fs::read_dir(workspace.join("packages")).unwrap() {
        let entry = entry.unwrap();
        if !entry.file_name().to_string_lossy().starts_with("native-") {
            continue;
        }
        let native = scope.join(entry.file_name());
        fs::create_dir_all(native.join("bin")).unwrap();
        fs::copy(
            entry.path().join("package.json"),
            native.join("package.json"),
        )
        .unwrap();
        std::os::unix::fs::symlink(env!("CARGO_BIN_EXE_mokly"), native.join("bin/mokly")).unwrap();
    }
    package.join("bin/mokly.mjs")
}
