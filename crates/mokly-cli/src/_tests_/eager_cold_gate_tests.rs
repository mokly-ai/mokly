//! Cold source boundaries use real signals and preserve the leased warm path.

use std::sync::{Arc, mpsc};
use std::thread::{self, JoinHandle};

use mokly_compare::error::{Error, Result};
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use unimock::{MockFn, Unimock, matching};

use crate::changes_source_admission::SourceCache;

use super::{SourceBound, SourceStarts, SourceStartsMock, SourceWait, StartupSources};

fn pending(
    bound: SourceBound,
) -> (
    Arc<StartupSources>,
    Arc<ChangeToken>,
    mpsc::Receiver<bool>,
    JoinHandle<Result<()>>,
) {
    let starts = Arc::new(StartupSources::default());
    let attempt = starts.begin();
    let cancel = Arc::new(ChangeToken::default());
    let (events, received) = mpsc::channel();
    let checked = events.clone();
    let state = starts.clone();
    let observed = starts.clone();
    let input = Arc::new(
        Unimock::new((
            SourceStartsMock::released
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, attempt, bound| {
                    checked.send(true).unwrap();
                    state.released(attempt, bound)
                })),
            SourceStartsMock::observe
                .some_call(matching!(_))
                .answers_arc(Arc::new(move |_, signal| observed.observe(signal))),
        ))
        .no_verify_in_drop(),
    );
    let wait = SourceWait::shared(input, cancel.clone(), bound, attempt);
    let run = thread::spawn(move || {
        let result = wait.enter(SourceCache::Unleased);
        events.send(false).unwrap();
        result
    });
    (starts, cancel, received, run)
}

#[test]
fn eager_cold_sources_follow_bundle_and_ready_boundaries() {
    for (bound, bundle, expected_bundle) in [
        (SourceBound::HeadBundleOrReady, true, true),
        (SourceBound::HeadBundleOrReady, false, false),
        (SourceBound::Ready, true, false),
    ] {
        let (starts, _, events, run) = pending(bound);
        let waited = events.recv().unwrap();
        if bundle {
            starts.bundle_finished(starts.current());
        }
        let after_bundle = starts.released(starts.current(), bound);
        starts.ready();
        let result = run.join().unwrap();
        assert_eq!(
            (waited, after_bundle, matches!(result, Ok(()))),
            (true, expected_bundle, true),
            "{bound:?}"
        );
    }
}

#[test]
fn eager_leased_sources_bypass_the_cold_start_boundary() {
    let starts = Arc::new(StartupSources::default());
    let wait = SourceWait::shared(
        starts.clone(),
        Arc::new(ChangeToken::default()),
        SourceBound::Ready,
        starts.begin(),
    );
    let result = wait.enter(SourceCache::Leased);
    assert!(matches!(result, Ok(())));
    assert!(!starts.released(starts.current(), SourceBound::Ready));
}

#[test]
fn eager_cold_source_cancellation_wakes_without_readiness() {
    let (starts, cancel, events, run) = pending(SourceBound::HeadBundleOrReady);
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
    assert!(!starts.released(starts.current(), SourceBound::Ready));
}

#[test]
fn eager_startup_bundle_milestone_resets_until_readiness_then_stays_open() {
    let starts = StartupSources::default();
    let first = starts.begin();
    starts.bundle_finished(first);
    let first_released = starts.released(first, SourceBound::HeadBundleOrReady);
    let second = starts.begin();
    starts.bundle_finished(first);
    let stale_released = starts.released(second, SourceBound::HeadBundleOrReady);
    starts.ready();
    let later = starts.begin();
    assert_eq!(
        [
            first_released,
            stale_released,
            starts.released(later, SourceBound::Ready)
        ],
        [true, false, true]
    );
}
