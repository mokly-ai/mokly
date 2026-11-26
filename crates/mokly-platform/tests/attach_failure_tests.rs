//! A failed attachment gives back its child only after the stop of its tree.

#![cfg(unix)]

use std::os::unix::process::ExitStatusExt;
use std::path::Path;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

use mokly_platform::error;
use mokly_platform::processes::{
    AttachFailure, ProcessGroups, ProcessGroupsMock, SystemProcessGroups,
};
use unimock::{MockFn, Unimock, matching};

#[test]
fn stop_kills_the_unattached_tree_before_it_gives_back_the_child() {
    let mut command = Command::new("sleep");
    command.arg("60");
    SystemProcessGroups.configure(&mut command).unwrap();
    let child = command.spawn().unwrap();
    let failure = AttachFailure::new(
        child,
        error::Error::Locked {
            path: "attach-probe".into(),
        },
    );
    let cause = std::error::Error::source(&failure).and_then(|cause| cause.downcast_ref());
    assert!(matches!(
        cause,
        Some(error::Error::Locked { path }) if path == Path::new("attach-probe")
    ));
    let mut unattached = failure.stop(&SystemProcessGroups);
    assert!(
        unattached.stopped.is_ok(),
        "stop failed: {:?}",
        unattached.stopped
    );
    // The bound only ends a failing run. A stopped tree exits at once.
    let deadline = Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = unattached.child.try_wait().unwrap() {
            break status;
        }
        if Instant::now() > deadline {
            let _ = unattached.child.kill();
            let _ = unattached.child.wait();
            panic!("the stop left the child running");
        }
        thread::yield_now();
    };
    assert_eq!(status.signal(), Some(libc::SIGKILL));
    assert!(matches!(
        &unattached.source,
        error::Error::Locked { path } if path == Path::new("attach-probe")
    ));
}

/// The stop is `kill_unattached` alone. It neither kills nor reaps the child,
/// which the caller does after the stop.
#[test]
fn stop_runs_kill_unattached_once_and_gives_back_the_running_child() {
    let mut command = Command::new("sleep");
    command.arg("60");
    SystemProcessGroups.configure(&mut command).unwrap();
    let child = command.spawn().unwrap();
    let groups = Unimock::new(
        ProcessGroupsMock::kill_unattached
            .next_call(matching!(_))
            .returns(Ok(())),
    );
    let failure = AttachFailure::new(
        child,
        error::Error::Locked {
            path: "attach-probe".into(),
        },
    );
    let mut unattached = failure.stop(&groups);
    let running = unattached.child.try_wait().unwrap().is_none();
    let _ = SystemProcessGroups.kill_unattached(&unattached.child);
    let _ = unattached.child.kill();
    let _ = unattached.child.wait();
    assert!(unattached.stopped.is_ok());
    assert!(running, "the stop ended the child itself");
}
