//! Reuse avoids preparation and drops invalid state before one fresh attempt.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::comparison_steps::Step;
use crate::error::Error;
use crate::source_failures::SourceFailuresMock;

use super::harness::Harness;
use super::support::{failures, generation, kept, provider_error, warning};

#[test]
fn two_classifications_prepare_and_capture_once_and_preserve_warnings_and_steps() {
    let reads = Arc::new(AtomicUsize::new(0));
    let failure = Arc::new(Mutex::new(None));
    let channel = Arc::new(Unimock::new((
        SourceFailuresMock::failure
            .each_call(matching!())
            .answers_arc({
                let failure = failure.clone();
                Arc::new(move |_| failure.lock().unwrap().clone())
            }),
        SourceFailuresMock::warnings
            .each_call(matching!())
            .returns(vec![warning()]),
    )));
    let harness = Harness::new(
        None,
        Some((generation(false, reads.clone()), channel)),
        true,
    );
    for _ in 0..2 {
        let result = harness.classify().unwrap();
        assert_eq!(result.warnings, vec![warning()]);
        assert!(result.before.comparison_capture().is_none());
    }
    {
        let state = harness.state.lock().unwrap();
        assert_eq!(
            (state.sources, state.prepares, state.captures, state.keeps),
            (1, 1, 1, 1)
        );
        assert_eq!((state.comparisons, state.releases), (2, 0));
        assert_eq!(reads.load(Ordering::Acquire), 2);
        assert_eq!(
            state.steps,
            vec![
                Step::Reading,
                Step::Rendering,
                Step::Comparing,
                Step::Reading,
                Step::Comparing
            ]
        );
    }
    *failure.lock().unwrap() = Some(Arc::new(Error::UnsupportedManager));
    assert!(matches!(
        harness.classify(),
        Err(Error::Base {
            scripts_off: true,
            ..
        })
    ));
}

#[test]
fn source_failure_on_a_kept_base_releases_it_with_its_scripts_hint() {
    let source = Arc::new(Error::UnsupportedManager);
    let harness = Harness::new(
        Some(kept(
            Arc::new(Unimock::new(())),
            Arc::new(Mutex::new(Some(source.clone()))),
        )),
        None,
        false,
    );
    let error = harness.classify().unwrap_err();
    assert!(
        matches!(error, Error::Base { commit, scripts_off: true, source: inner }
        if commit == "a".repeat(40)
            && matches!(inner.as_ref(), Error::SourceFailure { source: actual } if Arc::ptr_eq(actual, &source)))
    );
    let state = harness.state.lock().unwrap();
    assert_eq!(
        (
            state.releases,
            state.prepares,
            state.captures,
            state.comparisons
        ),
        (1, 0, 0, 0)
    );
    assert!(state.slot.is_none());
}

#[test]
fn failed_base_read_releases_before_one_fresh_attempt_and_stops_after_its_failure() {
    for records_source_failure in [false, true] {
        let failure = Arc::new(Mutex::new(None));
        let base = Arc::new(Unimock::new((
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
            RenderGenerationMock::resource_digest
                .each_call(matching!(_))
                .answers_arc({
                    let failure = failure.clone();
                    Arc::new(move |_, _| {
                        if records_source_failure {
                            *failure.lock().unwrap() = Some(Arc::new(Error::UnsupportedManager));
                        }
                        Err(provider_error())
                    })
                }),
        )));
        let harness = Harness::new(
            Some(kept(base, failure)),
            Some((
                generation(true, Arc::new(AtomicUsize::new(0))),
                failures(Arc::new(Mutex::new(None))),
            )),
            true,
        );
        let error = harness.classify().unwrap_err();
        assert!(
            matches!(
                error,
                Error::Graph {
                    source: GraphError::Internal(InternalError::Provider { .. })
                }
            ),
            "records_source_failure={records_source_failure}"
        );
        let state = harness.state.lock().unwrap();
        assert_eq!(
            (state.sources, state.prepares, state.captures, state.keeps),
            (1, 1, 1, 1),
            "records_source_failure={records_source_failure}"
        );
        assert_eq!(
            (state.comparisons, state.releases, state.alive_at_prepare),
            (2, 2, 0),
            "records_source_failure={records_source_failure}"
        );
        assert!(state.slot.is_none());
    }
}
