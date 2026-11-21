//! Cold source boundaries use real signals and preserve the leased warm path.

use std::sync::{Arc, mpsc};
use std::thread::{self, JoinHandle};

use mokly_compare::error::{Error, Result};
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::changes_source_admission::SourceCache;

use super::{SourceStarts, SourceStartsMock, SourceWait, StartupSources};

fn pending() -> (
    Arc<StartupSources>,
    Arc<ChangeToken>,
    mpsc::Receiver<bool>,
    JoinHandle<Result<()>>,
) {
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
                    checked.send(true).unwrap();
                    state.released()
                })),
            SourceStartsMock::observe
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, signal| observed.observe(signal))),
        ))
        .no_verify_in_drop(),
    );
    let wait = SourceWait::shared(input, cancel.clone());
    let run = thread::spawn(move || {
        let result = wait.enter(SourceCache::Unleased);
        events.send(false).unwrap();
        result
    });
    (starts, cancel, received, run)
}

#[test]
fn eager_cold_sources_wait_for_serve_readiness() {
    let (starts, _, events, run) = pending();
    let waited = events.recv().unwrap();
    let before_ready = starts.released();
    starts.ready();
    let result = run.join().unwrap();
    assert_eq!(
        (waited, before_ready, matches!(result, Ok(()))),
        (true, false, true)
    );
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
    let (starts, cancel, events, run) = pending();
    let waited = events.recv().unwrap();
    cancel.cancel();
    if !waited {
        starts.ready();
    }
    let result = run.join().unwrap();
    assert_eq!(
        (waited, matches!(result, Err(Error::Cancelled))),
        (true, true)
    );
    assert!(!starts.released());
}

#[test]
fn eager_startup_readiness_stays_open_for_later_source_waits() {
    let starts = Arc::new(StartupSources::default());
    starts.ready();
    let later = SourceWait::shared(starts.clone(), Arc::new(ChangeToken::default()));
    let result = later.enter(SourceCache::Unleased);
    assert_eq!((starts.released(), matches!(result, Ok(()))), (true, true));
}
