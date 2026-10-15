//! A real interrupt closes an active sidecar before the CLI process finishes.

#![cfg(unix)]

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
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
        let _ = self.child.kill();
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
        interrupt(signal);
    }
}

fn interrupt(signal: &str) {
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
    let mut child = Command::new(env!("CARGO_BIN_EXE_mokly"))
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
            .args([signal, &cleanup.child.id().to_string()])
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
