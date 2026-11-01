//! Deterministic deadlines and cancellation with mocked children and clocks.

use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{CancellationMock, ClockMock};
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::StorageMock;
use crate::commands::{Child, ChildMock, Command, Commands, Output, SpawnerMock, TimedCommands};
use crate::error::Error;

fn command() -> Command {
    Command {
        program: "npm".into(),
        args: vec![],
        scripts: false,
        directory: "/private".into(),
        timeout: Duration::from_secs(120),
        byte_limit: None,
        size_root: None,
        cache: None,
        node: None,
    }
}

#[test]
fn install_is_pending_before_the_deadline_and_killed_at_the_boundary() {
    let child = Unimock::new((
        ChildMock::poll.next_call(matching!()).returns(Ok(false)),
        ChildMock::kill.next_call(matching!()).returns(Ok(())),
        ChildMock::finish.next_call(matching!()).returns(Ok(Output {
            success: false,
            status: None,
            stdout: vec![],
        })),
    ));
    let clock = Unimock::new((
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::ZERO),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(119_999)),
        ClockMock::pause
            .next_call(matching!((duration) if *duration == Duration::from_millis(5)))
            .returns(()),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(120_000)),
    ));
    let child: Box<dyn Child> = Box::new(child);
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .next_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: Arc::new(clock),
        storage: Arc::new(Unimock::new(())),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
    };
    assert!(matches!(
        commands.run(&command()),
        Err(Error::InstallTimeout)
    ));
}

#[test]
fn cancellation_before_spawn_starts_nothing() {
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(())),
        clock: Arc::new(Unimock::new(())),
        storage: Arc::new(Unimock::new(())),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(true),
        )),
    };
    assert!(matches!(commands.run(&command()), Err(Error::Cancelled)));
}

#[test]
fn successful_command_drains_before_returning_bytes() {
    let child = Unimock::new((
        ChildMock::poll.next_call(matching!()).returns(Ok(true)),
        ChildMock::finish.next_call(matching!()).returns(Ok(Output {
            success: true,
            status: Some(0),
            stdout: b"11.0.0\n".to_vec(),
        })),
    ));
    let child: Box<dyn Child> = Box::new(child);
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .next_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        storage: Arc::new(Unimock::new(())),
    };
    assert_eq!(commands.run(&command()).unwrap(), b"11.0.0\n");
}

#[test]
fn size_failure_kills_and_drains_before_returning_the_bound_error() {
    let child: Box<dyn Child> = Box::new(Unimock::new((
        ChildMock::kill.next_call(matching!()).returns(Ok(())),
        ChildMock::finish.next_call(matching!()).returns(Ok(Output {
            success: false,
            status: None,
            stdout: vec![],
        })),
    )));
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .next_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
        storage: Arc::new(Unimock::new(
            StorageMock::size
                .next_call(matching!(_, 100))
                .returns(Err(Error::CacheLimit { limit: 100 })),
        )),
    };
    assert!(matches!(
        commands.run(&Command {
            byte_limit: Some(100),
            ..command()
        }),
        Err(Error::CacheLimit { limit: 100 })
    ));
}

#[test]
fn active_cancellation_keeps_its_result_and_skips_install_size_checks() {
    let child: Box<dyn Child> = Box::new(Unimock::new((
        ChildMock::terminate.next_call(matching!()).returns(Ok(())),
        ChildMock::poll.next_call(matching!()).returns(Ok(true)),
        ChildMock::finish.next_call(matching!()).returns(Ok(Output {
            success: false,
            status: None,
            stdout: vec![],
        })),
    )));
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .next_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: Arc::new(Unimock::new(
            ClockMock::now
                .each_call(matching!())
                .returns(Duration::ZERO),
        )),
        cancellation: Arc::new(Unimock::new((
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(false),
            CancellationMock::cancelled
                .next_call(matching!())
                .returns(true),
        ))),
        storage: Arc::new(Unimock::new(())),
    };
    assert!(matches!(
        commands.run(&Command {
            byte_limit: Some(100),
            ..command()
        }),
        Err(Error::Cancelled)
    ));
}
