//! Cancellation asserts process state and pause counts without elapsed-time bounds.

#[cfg(unix)]
use std::os::unix::process::ExitStatusExt;
#[cfg(windows)]
use std::os::windows::process::ExitStatusExt;
use std::process::ExitStatus;

use mokly_platform::processes::ProcessGroupMock;
use unimock::{MockFn, Unimock, matching};

use super::{ShutdownMock, graceful};

#[test]
fn prompt_exit_and_closed_pipes_need_no_pause_or_force_kill() {
    let group = Unimock::new(
        ProcessGroupMock::terminate
            .next_call(matching!())
            .returns(Ok(())),
    );
    let shutdown = Unimock::new(
        ShutdownMock::poll
            .next_call(matching!())
            .returns(Ok((Some(ExitStatus::from_raw(0)), true))),
    );
    assert!(graceful(&group, &shutdown).unwrap());
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
    let shutdown = Unimock::new((
        ShutdownMock::poll
            .each_call(matching!())
            .answers(&|_| Ok((Some(ExitStatus::from_raw(0)), false)))
            .n_times(101),
        ShutdownMock::pause
            .each_call(matching!())
            .returns(())
            .n_times(100),
    ));
    assert!(graceful(&group, &shutdown).unwrap());
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
    let shutdown = Unimock::new((
        ShutdownMock::poll
            .each_call(matching!())
            .answers(&|_| Ok((None, false)))
            .n_times(101),
        ShutdownMock::pause
            .each_call(matching!())
            .returns(())
            .n_times(100),
    ));
    assert!(!graceful(&group, &shutdown).unwrap());
}
