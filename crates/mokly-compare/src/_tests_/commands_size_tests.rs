//! Fake-time install size scans tolerate vanished files and run once per second.

use std::sync::Arc;
use std::time::Duration;

use mokly_git::control::{CancellationMock, ClockMock};
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::StorageMock;
use crate::commands::{Child, ChildMock, Command, Commands, Output, SpawnerMock, TimedCommands};
use crate::error::{Error, InternalError};

#[test]
fn vanished_nodes_do_not_kill_an_install_or_trigger_a_scan_on_every_poll() {
    let child: Box<dyn Child> = Box::new(Unimock::new((
        ChildMock::poll.next_call(matching!()).returns(Ok(false)),
        ChildMock::poll.next_call(matching!()).returns(Ok(false)),
        ChildMock::poll.next_call(matching!()).returns(Ok(true)),
        ChildMock::finish.next_call(matching!()).returns(Ok(Output {
            success: true,
            status: Some(0),
            stdout: vec![],
        })),
    )));
    let clock = Unimock::new((
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::ZERO),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::ZERO),
        ClockMock::pause.next_call(matching!(_)).returns(()),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_millis(999)),
        ClockMock::pause.next_call(matching!(_)).returns(()),
        ClockMock::now
            .next_call(matching!())
            .returns(Duration::from_secs(1)),
    ));
    let storage = Unimock::new((
        StorageMock::size
            .next_call(matching!(_, 100))
            .returns(Err(Error::Internal(InternalError::Io {
                source: std::io::Error::from(std::io::ErrorKind::NotFound),
            }))),
        StorageMock::size
            .next_call(matching!(_, 100))
            .returns(Ok(10)),
    ));
    let commands: &dyn Commands = &TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .next_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: Arc::new(clock),
        storage: Arc::new(storage),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .returns(false),
        )),
    };
    assert!(
        commands
            .run(&Command {
                program: "npm".into(),
                args: vec![],
                directory: "/private".into(),
                timeout: Duration::from_secs(120),
                byte_limit: Some(100),
                size_root: None,
                berry_cache: None,
            })
            .is_ok()
    );
}
