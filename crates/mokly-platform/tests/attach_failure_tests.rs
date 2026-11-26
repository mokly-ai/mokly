//! A failed attachment gives back its child only after the stop of its tree.

#![cfg(unix)]

use std::os::unix::process::ExitStatusExt;
use std::path::Path;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

use mokly_platform::error;
use mokly_platform::processes::{AttachFailure, ProcessGroups, SystemProcessGroups};

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
    assert!(matches!(
        failure.cause(),
        error::Error::Locked { path } if path == Path::new("attach-probe")
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
