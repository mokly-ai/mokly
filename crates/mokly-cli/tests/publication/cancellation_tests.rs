//! SIGINT cancels a blocked render or a Blob upload with the cancellation copy.

#![cfg(unix)]

use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use mokly_test_support::files::write;
use mokly_test_support::git::commit_all;
use mokly_test_support::process::{self, ChildId, Running};
use mokly_test_support::publication::{self, Outputs, TOKEN};
use mokly_test_support::receiver::{Exchange, Options};

use super::support::{missing, mokly};

const CANCELLED: &str = "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n";

const BLOCKING_PAGE: &str = "import fs from 'node:fs'; import {definePage} from '@mokly/mokly'; export default definePage({title:'Home',description:'',relatedDocs:[],render(){fs.writeFileSync('.context/ready','ready');fs.readFileSync('.context/render.pipe');return '<html><body>Home</body></html>'}});";

/// Wait until the render writes its readiness marker, and fail if the child exits first.
fn await_render(running: &mut Running, ready: &Path) {
    let started = Instant::now();
    while !ready.exists() {
        assert!(
            !running.has_exited(),
            "the child exited before render readiness"
        );
        assert!(
            started.elapsed() < Duration::from_secs(120),
            "the render never became ready"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn sigint_during_a_pipe_blocked_render_cancels_build_and_publish_before_installation() {
    for verb in ["build", "publish"] {
        let root = publication::fixture(true, "sha1");
        let path = root.path();
        let receiver = Exchange::start(Options::default());
        write(path, ".context/.keep", "");
        let status = Command::new("mkfifo")
            .arg(path.join(".context/render.pipe"))
            .status()
            .unwrap();
        assert!(status.success());
        write(path, "specs/home.mockup.ts", BLOCKING_PAGE);
        commit_all(path, "blocking render");
        let mut running = if verb == "publish" {
            publication::publish(&mokly(), path, &receiver.endpoint, "plain", &[]).spawn()
        } else {
            mokly()
                .command(
                    path,
                    &[
                        "build",
                        "--no-changes",
                        "--sidecars=1",
                        "--out=.context/site",
                    ],
                    "plain",
                )
                .spawn()
        };
        await_render(&mut running, &path.join(".context/ready"));
        running.signal("INT");
        let result = running.wait();
        assert_eq!(result.code, Some(1));
        let mut outputs = Outputs::default();
        let output = if verb == "publish" {
            let output = publication::directory(&result.stdout);
            outputs.push(output.clone());
            assert_eq!(result.stderr, CANCELLED);
            output
        } else {
            assert_eq!(result.stderr, "[mokly/build-invalid] build cancelled\n");
            assert_eq!(result.stdout, "");
            path.join(".context/site")
        };
        assert!(receiver.record().bodies.is_empty());
        missing(&output);
        receiver.close();
    }
}

#[test]
fn plain_and_rich_sigint_during_blob_upload_keeps_the_installed_site_and_uses_cancellation_copy() {
    for mode in ["plain", "rich"] {
        let root = publication::fixture(false, "sha1");
        let child = ChildId::default();
        let interrupted = child.clone();
        let signals = Arc::new(AtomicBool::new(false));
        let sent = Arc::clone(&signals);
        let receiver = Exchange::start(Options {
            hold_blob: Some(Arc::new(move || {
                if !sent.swap(true, Ordering::SeqCst) {
                    process::signal(interrupted.wait(), "INT");
                }
            })),
            ..Options::default()
        });
        let running =
            publication::publish(&mokly(), root.path(), &receiver.endpoint, mode, &[]).spawn();
        child.set(running.pid());
        let result = running.wait();
        let output = publication::directory(&result.stdout);
        let mut outputs = Outputs::default();
        outputs.push(output.clone());
        assert!(signals.load(Ordering::SeqCst));
        assert_eq!(result.code, Some(1));
        assert!(result.stderr.contains("Publication was cancelled"));
        assert!(!result.stderr.contains("connection"));
        assert!(!result.stderr.contains(TOKEN));
        if mode == "rich" {
            assert!(result.stdout.contains("Uploading catalogue"));
        } else {
            assert_eq!(result.stderr, CANCELLED);
        }
        assert_eq!(receiver.record().completed, 0);
        assert!(output.join(".mokly-export-artifact").is_file());
        receiver.close();
    }
}
