//! Pending commands and pipes receive one forceful signal at fake one second.

use std::time::Duration;

use mokly_platform::error;
use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::signal;
use crate::control::Shutdown;
use crate::error::Error;

#[test]
fn prompt_exit_and_closed_pipes_need_no_pause_or_force_kill() {
    let group = Unimock::new(
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Ok(())),
    );
    signal(&mut Shutdown::default(), &group, Duration::ZERO, true).unwrap();
}

#[test]
fn an_exited_leader_with_open_pipes_gets_one_force_kill_after_the_grace_budget() {
    let group = Unimock::new((
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Ok(())),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let mut shutdown = Shutdown::default();
    signal(&mut shutdown, &group, Duration::ZERO, true).unwrap();
    signal(&mut shutdown, &group, Duration::from_millis(999), true).unwrap();
    signal(&mut shutdown, &group, Duration::from_secs(1), true).unwrap();
    signal(&mut shutdown, &group, Duration::from_secs(2), true).unwrap();
}

#[test]
fn a_running_process_gets_one_force_kill_after_the_grace_budget() {
    let group = Unimock::new((
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Ok(())),
        ProcessGroupMock::kill
            .next_call(matching!())
            .returns(Ok(())),
    ));
    let mut shutdown = Shutdown::default();
    for tick in 0..=101 {
        signal(
            &mut shutdown,
            &group,
            Duration::from_millis(tick * 10),
            true,
        )
        .unwrap();
    }
}

#[test]
fn signal_failure_preserves_the_platform_error() {
    let group = Unimock::new(
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Err(error::Error::InvalidPath {
                path: "signal".into(),
            })),
    );
    assert!(matches!(
        signal(&mut Shutdown::default(), &group, Duration::ZERO, true),
        Err(Error::Platform { .. })
    ));
}
