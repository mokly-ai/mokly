//! Real process helpers with readiness channels and failure-safe cleanup.

use std::env;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

use mokly_platform::processes::{ProcessGroup, ProcessGroups, SystemProcessGroups};

use super::unix_status;

/// Owned manager and every helper PID reported before readiness.
pub(crate) struct Tree {
    /// Package-manager root that the test must reap.
    pub(crate) child: Child,
    /// Public ownership boundary exercised by the tests.
    pub(crate) group: Box<dyn ProcessGroup>,
    /// New-session parent and its child, in that order.
    pub(crate) pids: Vec<i32>,
}

impl Tree {
    /// Start a manager and wait for its complete helper tree to be ready.
    pub(crate) fn start(mode: &str) -> Self {
        let mut command = helper("manager", mode);
        command.stdout(Stdio::piped());
        SystemProcessGroups.configure(&mut command).unwrap();
        let mut child = command.spawn().unwrap();
        let group = match SystemProcessGroups.attach(&child) {
            Ok(group) => group,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                panic!("attach failed: {error}");
            }
        };
        let reader = BufReader::new(child.stdout.take().unwrap());
        let mut tree = Self {
            child,
            group,
            pids: Vec::new(),
        };
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || sender.send(read_ready(reader)).unwrap());
        tree.pids = receiver.recv_timeout(Duration::from_secs(10)).unwrap();
        assert_eq!(tree.pids.len(), 2);
        tree
    }
}

impl Drop for Tree {
    fn drop(&mut self) {
        for &pid in self.pids.iter().rev() {
            unix_status::kill(pid);
        }
        let _ = self.group.kill();
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Re-exec the test helper with an isolated role and scenario.
pub(super) fn helper(role: &str, mode: &str) -> Command {
    let mut command = Command::new(env::current_exe().unwrap());
    command
        .args(["--exact", "unix::new_session_helper", "--nocapture"])
        .env("MOKLY_TREE_ROLE", role)
        .env("MOKLY_TREE_MODE", mode)
        .stdin(Stdio::null())
        .stderr(Stdio::null());
    command
}

/// Read helper PIDs after libtest's startup output.
pub(super) fn read_ready(reader: impl BufRead) -> Vec<i32> {
    for line in reader.lines() {
        let line = line.unwrap();
        if let Some(pids) = line.strip_prefix("mokly-tree-ready:") {
            return pids
                .split_whitespace()
                .map(|pid| pid.parse().unwrap())
                .collect();
        }
    }
    panic!("helper exited before readiness");
}

/// Send one complete readiness record to the parent's pipe.
pub(super) fn report(pids: &[i32]) {
    let pids: Vec<_> = pids.iter().map(i32::to_string).collect();
    println!("mokly-tree-ready: {}", pids.join(" "));
}
