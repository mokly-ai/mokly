//! Cold source boundaries use real signals and preserve the leased warm path.

use std::sync::{Arc, mpsc};
use std::thread::{self, JoinHandle};

use mokly_compare::error::{Error, Result};
use mokly_server::changes::{ChangeCancellation, ChangeCancellationMock, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::changes_source_admission::SourceCache;

use super::{SourceStarts, SourceStartsMock, SourceWait, StartupSources};

#[derive(Debug, PartialEq, Eq)]
enum SourceEvent {
    Readiness(bool),
    Cancellation(bool),
    Entered,
}

type Pending = (
    Arc<StartupSources>,
    Arc<ChangeToken>,
    mpsc::Receiver<SourceEvent>,
    JoinHandle<Result<()>>,
    Unimock,
);

fn pending() -> Pending {
    let starts = Arc::new(StartupSources::default());
    let cancel = Arc::new(ChangeToken::default());
    let (events, received) = mpsc::channel();
    let checked = events.clone();
    let state = starts.clone();
    let observed = starts.clone();
    let input = Arc::new(
        Unimock::new((
            SourceStartsMock::released
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    let ready = state.released();
                    checked.send(SourceEvent::Readiness(ready)).unwrap();
                    ready
                })),
            SourceStartsMock::observe
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, signal| observed.observe(signal))),
        ))
        .no_verify_in_drop(),
    );
    let token = cancel.clone();
    let observed = cancel.clone();
    let checked = events.clone();
    let cancellation = Unimock::new((
        ChangeCancellationMock::cancelled
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| {
                let cancelled = token.cancelled();
                checked.send(SourceEvent::Cancellation(cancelled)).unwrap();
                cancelled
            })),
        ChangeCancellationMock::observe
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, signal| observed.observe(signal))),
    ));
    let wait = SourceWait::shared(input, Arc::new(cancellation.clone()));
    let run = thread::spawn(move || {
        let result = wait.enter(SourceCache::Unleased);
        events.send(SourceEvent::Entered).unwrap();
        result
    });
    (starts, cancel, received, run, cancellation)
}

fn finish(
    events: mpsc::Receiver<SourceEvent>,
    mut observed: Vec<SourceEvent>,
    run: JoinHandle<Result<()>>,
) -> (Vec<SourceEvent>, Result<()>) {
    while observed.last() != Some(&SourceEvent::Entered) {
        match events.recv() {
            Ok(event) => observed.push(event),
            Err(_) => break,
        }
    }
    (observed, run.join().unwrap())
}

#[test]
fn eager_cold_sources_wait_for_serve_readiness() {
    let (starts, _, events, run, _cancellation) = pending();
    let first = events.recv().unwrap();
    let waited = first == SourceEvent::Readiness(false);
    let before_ready = starts.released();
    starts.ready();
    let (observed, result) = finish(events, vec![first], run);
    assert_eq!(
        (waited, before_ready, matches!(result, Ok(()))),
        (true, false, true)
    );
    assert!(
        observed.contains(&SourceEvent::Readiness(true)),
        "enter must recheck readiness before completion: {observed:?}"
    );
    assert_eq!(observed.last(), Some(&SourceEvent::Entered));
}

#[test]
fn eager_leased_sources_bypass_the_cold_start_boundary() {
    let starts = Arc::new(StartupSources::default());
    let wait = SourceWait::shared(starts.clone(), Arc::new(ChangeToken::default()));
    let result = wait.enter(SourceCache::Leased);
    assert!(matches!(result, Ok(())));
    assert!(!starts.released());
}

#[test]
fn eager_cold_source_cancellation_wakes_without_readiness() {
    let (starts, cancel, events, run, _cancellation) = pending();
    let first = events.recv().unwrap();
    let waited = first == SourceEvent::Readiness(false);
    let mut observed = vec![first];
    while !matches!(
        observed.last(),
        Some(SourceEvent::Cancellation(false) | SourceEvent::Entered)
    ) {
        match events.recv() {
            Ok(event) => observed.push(event),
            Err(_) => break,
        }
    }
    let before_cancel = observed.len();
    cancel.cancel();
    let (observed, result) = finish(events, observed, run);
    assert_eq!(
        (waited, matches!(result, Err(Error::Cancelled))),
        (true, true)
    );
    assert!(!starts.released());
    assert!(observed[..before_cancel].contains(&SourceEvent::Cancellation(false)));
    assert!(
        observed[before_cancel..].contains(&SourceEvent::Readiness(false)),
        "cancellation must wake the blocked readiness loop: {observed:?}"
    );
    assert_eq!(observed.last(), Some(&SourceEvent::Entered));
}

#[test]
fn eager_startup_readiness_stays_open_for_later_source_waits() {
    let starts = Arc::new(StartupSources::default());
    starts.ready();
    let later = SourceWait::shared(starts.clone(), Arc::new(ChangeToken::default()));
    let result = later.enter(SourceCache::Unleased);
    assert_eq!((starts.released(), matches!(result, Ok(()))), (true, true));
}
