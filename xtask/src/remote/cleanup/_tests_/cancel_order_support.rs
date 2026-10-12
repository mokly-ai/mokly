//! Captured cleanup events with independent status, stop and cancel outcomes.

use std::io;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::*;
use crate::remote::error::{Error, Operation};

#[derive(Clone, Copy, Default)]
pub(super) enum Cancel {
    #[default]
    Pass,
    Completed,
    Other,
    StateError,
    Panic,
}

pub(super) struct Config {
    pub(super) github: bool,
    pub(super) statuses: Vec<&'static str>,
    pub(super) failed_stops: usize,
    pub(super) cancel: Cancel,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            github: true,
            statuses: vec!["/actions/runs/123"],
            failed_stops: 0,
            cancel: Cancel::Pass,
        }
    }
}

pub(super) fn fixture(config: Config) -> (Dependencies, Arc<Mutex<Vec<String>>>) {
    let events = Arc::new(Mutex::new(Vec::new()));
    let closes = events.clone();
    let statuses = events.clone();
    let stops = events.clone();
    let messages = events.clone();
    let cancels = events.clone();
    let states = events.clone();
    let waits = events.clone();
    let status_index = AtomicUsize::new(0);
    let attempts = AtomicUsize::new(0);
    let shared = Arc::new(
        Unimock::new((
            ProgramsFindMock
                .each_call(matching!("gh"))
                .answers_arc(Arc::new(move |_, _| Ok(config.github))),
            BlacksmithDisconnectMock
                .each_call(matching!("tbx_a"))
                .answers_arc(Arc::new(move |_, _| {
                    closes.lock().unwrap().push("close".into());
                    Ok(Disconnection::Closed)
                })),
            BlacksmithStatusMock
                .each_call(matching!("tbx_a"))
                .answers_arc(Arc::new(move |_, _| {
                    statuses.lock().unwrap().push("status".into());
                    let index = status_index
                        .fetch_add(1, Ordering::SeqCst)
                        .min(config.statuses.len() - 1);
                    Ok(config.statuses[index].into())
                })),
            BlacksmithStopMock
                .each_call(matching!("tbx_a"))
                .answers_arc(Arc::new(move |_, _| {
                    stops.lock().unwrap().push("stop".into());
                    if attempts.fetch_add(1, Ordering::SeqCst) < config.failed_stops {
                        Err(Error::Io {
                            operation: Operation::Blacksmith,
                            source: io::Error::other("stop failed"),
                        })
                    } else {
                        Ok(())
                    }
                })),
            GithubCancelMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, id| {
                    cancels.lock().unwrap().push(format!("cancel:{id}"));
                    match config.cancel {
                        Cancel::Pass => Ok(()),
                        Cancel::Panic => panic!("cancellation boundary panics"),
                        _ => Err(Error::Io {
                            operation: Operation::Github,
                            source: io::Error::other("cancel failed"),
                        }),
                    }
                })),
            GithubStateMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, id| {
                    states.lock().unwrap().push(format!("state:{id}"));
                    match config.cancel {
                        Cancel::Completed => Ok(GithubRunState::Completed),
                        Cancel::StateError => Err(Error::Io {
                            operation: Operation::Github,
                            source: io::Error::other("state failed"),
                        }),
                        _ => Ok(GithubRunState::Other),
                    }
                })),
            ClockWaitMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, duration| {
                    waits
                        .lock()
                        .unwrap()
                        .push(format!("wait:{}", duration.as_secs()));
                })),
            ReporterExecutorMock
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, message| {
                    messages.lock().unwrap().push(format!("message:{message}"));
                })),
        ))
        .no_verify_in_drop(),
    );
    let unused = Arc::new(Unimock::new(()));
    (
        Dependencies {
            environment: unused.clone(),
            programs: shared.clone(),
            clock: shared.clone(),
            snapshot: Arc::new(Unimock::new(())),
            git: unused.clone(),
            blacksmith: shared.clone(),
            github: shared.clone(),
            fingerprint: unused.clone(),
            aggregate: unused.clone(),
            logs: unused.clone(),
            interrupt: unused,
            reporter: shared,
            workspace: PathBuf::from("/workspace"),
        },
        events,
    )
}

pub(super) fn operations(events: &[String]) -> Vec<&str> {
    events
        .iter()
        .filter(|event| !event.starts_with("message:"))
        .map(String::as_str)
        .collect()
}

pub(super) fn cancel_line() -> &'static str {
    "message:information: cleanup box=tbx_a GitHub run=123"
}

pub(super) fn assert_cancel_line(events: &[String]) {
    let position = events
        .iter()
        .position(|event| event == "cancel:123")
        .unwrap();
    assert_eq!(events[position - 1], cancel_line());
    assert_eq!(
        events
            .iter()
            .filter(|event| event.as_str() == cancel_line())
            .count(),
        1
    );
}
