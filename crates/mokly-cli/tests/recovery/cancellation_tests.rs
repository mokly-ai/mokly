//! SIGINT during a FIFO-blocked Git command or a compiler gate reports exact cancellation.

#![cfg(unix)]

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::files::write;
use mokly_test_support::git::git;
use mokly_test_support::process::Running;
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};
use regex::Regex;

use super::support::mokly;

const CANCELLED: &str = "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n";

fn fifo(path: &Path) {
    let status = Command::new("mkfifo").arg(path).status().unwrap();
    assert!(status.success());
}

fn await_marker(running: &mut Running, marker: &Path) {
    let started = Instant::now();
    while !marker.exists() {
        assert!(
            !running.has_exited(),
            "the child exited before readiness: {}",
            running.stderr()
        );
        assert!(
            started.elapsed() < Duration::from_secs(120),
            "the marker never appeared"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn sigint_during_fifo_blocked_git_reports_exact_build_and_publish_cancellation() {
    for verb in ["build", "publish"] {
        let root = publication::fixture(false, "sha1");
        let receiver = Exchange::start(Options::default());
        let scratch = root.path().join(".context");
        fs::create_dir(&scratch).unwrap();
        let pipe = scratch.join("git.pipe");
        fifo(&pipe);
        let shim = scratch.join("git");
        fs::write(
            &shim,
            "#!/bin/sh\nprintf ready > \"$MOKLY_GIT_READY\"\nexec /bin/cat \"$MOKLY_GIT_FIFO\"\n",
        )
        .unwrap();
        fs::set_permissions(&shim, fs::Permissions::from_mode(0o755)).unwrap();
        let path = format!(
            "{}:{}",
            scratch.display(),
            std::env::var("PATH").unwrap_or_default()
        );
        let invocation = if verb == "build" {
            mokly().command(root.path(), &["build", "--out=.context/site"], "plain")
        } else {
            publication::publish(&mokly(), root.path(), &receiver.endpoint, "plain", &[])
        };
        let mut running = invocation
            .env("PATH", path)
            .env("MOKLY_GIT_READY", scratch.join("ready"))
            .env("MOKLY_GIT_FIFO", &pipe)
            .spawn();
        await_marker(&mut running, &scratch.join("ready"));
        running.signal("INT");
        let result = running.wait();
        assert_eq!(result.code, Some(1));
        let expected = if verb == "build" {
            "[mokly/build-invalid] build cancelled\n"
        } else {
            CANCELLED
        };
        assert_eq!(result.stderr, expected);
        assert_eq!(result.stdout, "");
        assert!(receiver.record().bodies.is_empty());
        assert!(!scratch.join("site").exists());
        receiver.close();
    }
}

#[test]
fn publication_cancellation_keeps_the_real_compiler_diagnostic_in_its_cause_chain() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    fs::create_dir(path.join(".context")).unwrap();
    write(path, "specs/home.mockup.ts", "export const broken = ;");
    git(path, &["add", "."]);
    git(path, &["commit", "-qm", "invalid source"]);
    let ready = path.join(".context/ready");
    let mut running = publication::publish(&mokly(), path, "http://127.0.0.1:1/plan", "plain", &[])
        .env("MOKLY_DIAGNOSTIC", "1")
        .env("MOKLY_TEST_STATIC_FAULTS", "compile")
        .env("MOKLY_TEST_STATIC_READY", &ready)
        .spawn();
    await_marker(&mut running, &ready);
    running.signal("INT");
    let result = running.wait();
    let output = publication::directory(&result.stdout);
    let mut outputs = Outputs::default();
    outputs.push(output.clone());
    assert_eq!(result.code, Some(1));
    assert!(result.stderr.starts_with(CANCELLED));
    assert!(result.stderr.contains("Diagnostic causes:"));
    assert!(
        Regex::new(r"home\.mockup\.ts:1:")
            .unwrap()
            .is_match(&result.stderr)
    );
    assert!(result.stderr.contains("Unexpected"));
    assert!(!result.stderr.contains(TOKEN));
    assert!(!output.exists());
}
