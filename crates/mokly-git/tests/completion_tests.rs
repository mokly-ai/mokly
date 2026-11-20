//! Child and pipe completion wake supervision without a polling timer.

#![cfg(unix)]

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::process::Command;
use std::sync::mpsc::sync_channel;
#[cfg(target_os = "linux")]
use std::sync::mpsc::{Receiver, SyncSender};
use std::thread;
use std::time::Duration;

use mokly_git::command::{Cancellation, Request, Runner};
use mokly_git::error::{Error, InternalError};

#[path = "support/completion.rs"]
mod completion;
use completion::Supervisor;

#[cfg(target_os = "linux")]
#[test]
fn an_exited_child_waits_for_stdout_and_pipe_completion_wakes_the_supervisor() {
    let root = tempfile::tempdir().unwrap();
    let request = Request {
        args: vec!["hash-object".into(), "--stdin".into()],
        stdin: vec![0, 255, 10],
        ..request(root.path())
    };
    thread::scope(|scope| {
        let supervisor = Supervisor::new();
        let runner = supervisor.runner();
        let (writing, ready) = sync_channel(1);
        let (release, waiting) = sync_channel(1);
        let (returned, result) = sync_channel(1);
        scope.spawn(move || {
            let mut sink = HeldWriter {
                writing,
                waiting: Some(waiting),
                bytes: Vec::new(),
            };
            let output = runner.copy(&request, &mut sink, 41);
            let _ = returned.send((output, sink.bytes));
        });
        ready.recv_timeout(Duration::from_secs(10)).unwrap();
        supervisor.wait_for_child_exit();
        supervisor.park();
        release.send(()).unwrap();
        let (output, bytes) = supervisor.finish(&result);
        output.unwrap();
        assert_eq!(bytes, b"506cd141ad4a679eee22d6a21dd267cca5734b92\n");
    });
}

#[test]
fn closed_pipes_wait_for_the_child_and_child_completion_wakes_the_supervisor() {
    let root = tempfile::tempdir().unwrap();
    fifo(root.path(), "release");
    fifo(root.path(), "ready");
    let executable = root.path().join("git");
    fs::write(
        &executable,
        b"#!/bin/sh\nexec 3<release\nprintf 'complete stdout'\nprintf 'complete stderr' >&2\nexec 0<&- 1>&- 2>&-\nprintf ready > ready\nread release <&3\n",
    )
    .unwrap();
    fs::set_permissions(executable, fs::Permissions::from_mode(0o755)).unwrap();
    let request = request(root.path());
    thread::scope(|scope| {
        let supervisor = Supervisor::new();
        let runner = supervisor.runner();
        let (returned, result) = sync_channel(1);
        scope.spawn(move || {
            let _ = returned.send(runner.run_cancellable_with_environment_timeout(
                &request,
                &Active,
                &[("PATH", request.directory.clone().into_os_string())],
                Duration::from_secs(30),
            ));
        });
        let mut release = File::create(root.path().join("release")).unwrap();
        let mut ready = Vec::new();
        File::open(root.path().join("ready"))
            .unwrap()
            .read_to_end(&mut ready)
            .unwrap();
        assert_eq!(ready, b"ready");
        supervisor.park();
        release.write_all(b"finish\n").unwrap();
        let output = supervisor.finish(&result).unwrap();
        assert_eq!(output.stdout, b"complete stdout");
        assert_eq!(output.stderr, b"complete stderr");
    });
}

#[test]
fn a_panicking_stdout_worker_stops_the_child_and_keeps_the_worker_error() {
    let root = tempfile::tempdir().unwrap();
    fifo(root.path(), "hold");
    let request = Request {
        args: vec![
            "-c".into(),
            "alias.hold=!printf prefix; read release < hold".into(),
            "hold".into(),
        ],
        ..request(root.path())
    };
    thread::scope(|scope| {
        let supervisor = Supervisor::new();
        let runner = supervisor.runner();
        let (returned, result) = sync_channel(1);
        scope.spawn(move || {
            let _ = returned.send(runner.copy(&request, &mut PanickingWriter, 6));
        });
        assert!(matches!(
            supervisor.finish(&result),
            Err(Error::Internal(InternalError::Worker))
        ));
    });
}

fn request(root: &Path) -> Request {
    Request {
        process_mode: Default::default(),
        directory: root.to_owned(),
        args: vec!["--version".into()],
        stdin: Vec::new(),
        output_limit: 1024,
        stderr_limit: 1024,
    }
}

fn fifo(root: &Path, name: &str) {
    assert!(
        Command::new("mkfifo")
            .arg(root.join(name))
            .status()
            .unwrap()
            .success()
    );
}

#[cfg(target_os = "linux")]
struct HeldWriter {
    writing: SyncSender<()>,
    waiting: Option<Receiver<()>>,
    bytes: Vec<u8>,
}

#[cfg(target_os = "linux")]
impl Write for HeldWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if let Some(waiting) = self.waiting.take() {
            self.writing.send(()).unwrap();
            waiting.recv_timeout(Duration::from_secs(10)).unwrap();
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct PanickingWriter;

impl Write for PanickingWriter {
    fn write(&mut self, _: &[u8]) -> io::Result<usize> {
        panic!("intentional output sink panic");
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

struct Active;

impl Cancellation for Active {
    fn is_cancelled(&self) -> bool {
        false
    }
}
