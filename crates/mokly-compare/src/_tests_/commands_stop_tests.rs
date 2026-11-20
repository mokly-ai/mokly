//! Stopped commands retain their result and bound every pending cleanup wait.

use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::Duration;

use mokly_git::control::{CancellationMock, Clock, ClockMock};
use unimock::{MockFn, Unimock, matching};

use crate::cache_types::StorageMock;
use crate::commands::{Child, ChildMock, Command, Commands, SpawnerMock, TimedCommands};
use crate::error::{Error, InternalError};

fn command() -> Command {
    Command {
        program: "npm".into(),
        args: vec![],
        scripts: false,
        directory: "/private".into(),
        timeout: Duration::ZERO,
        byte_limit: None,
        size_root: None,
        cache: None,
        node: None,
    }
}

fn clock(milliseconds: Arc<AtomicU64>) -> Arc<dyn Clock> {
    let paused = milliseconds.clone();
    Arc::new(Unimock::new((
        ClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                Duration::from_millis(milliseconds.load(Ordering::SeqCst))
            })),
        ClockMock::pause
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, duration| {
                paused.fetch_add(duration.as_millis() as u64, Ordering::SeqCst);
            })),
    )))
}

#[derive(Clone, Copy, Debug)]
enum Cause {
    Timeout,
    Size,
    Output,
    Poll,
}

#[test]
fn each_stop_keeps_its_error_and_abandons_pending_workers_at_the_grace_boundary() {
    for cause in [Cause::Timeout, Cause::Size, Cause::Output, Cause::Poll] {
        let milliseconds = Arc::new(AtomicU64::new(0));
        let observed = milliseconds.clone();
        let polls = Arc::new(AtomicUsize::new(0));
        let counted = polls.clone();
        let abandoned = Arc::new(AtomicU64::new(u64::MAX));
        let detached = abandoned.clone();
        let child: Box<dyn Child> = Box::new(Unimock::new((
            ChildMock::poll
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let first = counted.fetch_add(1, Ordering::SeqCst) == 0;
                    match (cause, first) {
                        (Cause::Output, true) => Err(Error::CommandOutputLimit),
                        (Cause::Poll, true) => Err(InternalError::Worker.into()),
                        _ => Ok(false),
                    }
                })),
            ChildMock::kill.some_call(matching!()).returns(Ok(())),
            ChildMock::abandon
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    detached.store(observed.load(Ordering::SeqCst), Ordering::SeqCst);
                })),
        )));
        let storage = if matches!(cause, Cause::Size) {
            Unimock::new(
                StorageMock::size
                    .some_call(matching!(_, 100))
                    .returns(Err(Error::CacheLimit { limit: 100 })),
            )
        } else {
            Unimock::new(())
        };
        let commands = TimedCommands {
            spawner: Arc::new(Unimock::new(
                SpawnerMock::spawn
                    .some_call(matching!(_))
                    .returns(Ok(child)),
            )),
            clock: clock(milliseconds.clone()),
            cancellation: Arc::new(Unimock::new(
                CancellationMock::cancelled
                    .each_call(matching!())
                    .returns(false),
            )),
            storage: Arc::new(storage),
        };
        let mut request = command();
        if !matches!(cause, Cause::Timeout) {
            request.timeout = Duration::from_secs(120);
        }
        request.byte_limit = matches!(cause, Cause::Size).then_some(100);
        let result = commands.run(&request);
        assert!(matches!(
            (cause, result),
            (Cause::Timeout, Err(Error::InstallTimeout))
                | (Cause::Size, Err(Error::CacheLimit { limit: 100 }))
                | (Cause::Output, Err(Error::CommandOutputLimit))
                | (Cause::Poll, Err(Error::Internal(InternalError::Worker)))
        ));
        assert_eq!(abandoned.load(Ordering::SeqCst), 100, "{cause:?}");
        let expected = if matches!(cause, Cause::Output | Cause::Poll) {
            22
        } else {
            21
        };
        assert_eq!(polls.load(Ordering::SeqCst), expected, "{cause:?}");
    }
}

#[test]
fn cancellation_waits_one_second_before_kill_and_only_one_grace_after_it() {
    let milliseconds = Arc::new(AtomicU64::new(0));
    let terminated = Arc::new(AtomicU64::new(u64::MAX));
    let killed = Arc::new(AtomicU64::new(u64::MAX));
    let abandoned = Arc::new(AtomicU64::new(u64::MAX));
    let at_terminate = milliseconds.clone();
    let at_kill = milliseconds.clone();
    let at_abandon = milliseconds.clone();
    let term = terminated.clone();
    let kill = killed.clone();
    let abandon = abandoned.clone();
    let child: Box<dyn Child> = Box::new(Unimock::new((
        ChildMock::poll
            .each_call(matching!())
            .answers(&|_| Ok(false)),
        ChildMock::terminate
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                term.store(at_terminate.load(Ordering::SeqCst), Ordering::SeqCst);
                Ok(())
            })),
        ChildMock::kill
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                kill.store(at_kill.load(Ordering::SeqCst), Ordering::SeqCst);
                Ok(())
            })),
        ChildMock::abandon
            .some_call(matching!())
            .answers_arc(Arc::new(move |_| {
                abandon.store(at_abandon.load(Ordering::SeqCst), Ordering::SeqCst);
            })),
    )));
    let commands = TimedCommands {
        spawner: Arc::new(Unimock::new(
            SpawnerMock::spawn
                .some_call(matching!(_))
                .returns(Ok(child)),
        )),
        clock: clock(milliseconds),
        cancellation: Arc::new(Unimock::new(CancellationMock::cancelled.stub(|each| {
            each.call(matching!())
                .returns(false)
                .once()
                .then()
                .returns(true);
        }))),
        storage: Arc::new(Unimock::new(())),
    };
    assert!(matches!(commands.run(&command()), Err(Error::Cancelled)));
    assert_eq!(terminated.load(Ordering::SeqCst), 0);
    assert_eq!(killed.load(Ordering::SeqCst), 1000);
    assert_eq!(abandoned.load(Ordering::SeqCst), 1100);
}
