//! Cancellation stops later reader calls while an already running base read finishes.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use std::thread;

use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::error::Error;

use super::harness::Harness;
use super::support::kept;

#[test]
fn cancellation_during_a_base_read_finishes_that_call_and_preserves_the_next_reader() {
    let entered = Arc::new(Barrier::new(2));
    let resume = Arc::new(Barrier::new(2));
    let reads = Arc::new(AtomicUsize::new(0));
    let completed = Arc::new(AtomicUsize::new(0));
    let generation = Arc::new(Unimock::new((
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        RenderGenerationMock::resource_digest
            .each_call(matching!(_))
            .answers_arc({
                let entered = entered.clone();
                let resume = resume.clone();
                let reads = reads.clone();
                let completed = completed.clone();
                Arc::new(move |_, _| {
                    if reads.fetch_add(1, Ordering::AcqRel) == 0 {
                        entered.wait();
                        resume.wait();
                    }
                    completed.fetch_add(1, Ordering::AcqRel);
                    Ok(Some("digest".into()))
                })
            }),
    )));
    let failure = Arc::new(Mutex::new(None));
    let base = kept(generation, failure.clone());
    let harness = Harness::new(Some(base.clone()), None, true);
    thread::scope(|scope| {
        let running = scope.spawn(|| {
            let result = harness.classify().unwrap();
            result.before.resource_digest("static/after-cancel.png")
        });
        entered.wait();
        assert_eq!(completed.load(Ordering::Acquire), 0);
        harness.cancelled.store(true, Ordering::Release);
        resume.wait();
        let error = running.join().unwrap().unwrap_err();
        assert!(
            matches!(error, GraphError::Runtime { source } if source.code == RuntimeCode::Cancelled)
        );
    });
    assert_eq!(completed.load(Ordering::Acquire), 1);
    harness.cancelled.store(false, Ordering::Release);
    harness.classify().unwrap();
    {
        let state = harness.state.lock().unwrap();
        assert_eq!(
            (
                state.sources,
                state.prepares,
                state.captures,
                state.releases
            ),
            (0, 0, 0, 0)
        );
        assert!(Arc::ptr_eq(state.slot.as_ref().unwrap(), &base));
    }
    assert_eq!(reads.load(Ordering::Acquire), 2);
    *failure.lock().unwrap() = Some(Arc::new(Error::UnsupportedManager));
    assert!(matches!(
        harness.classify(),
        Err(Error::Base {
            scripts_off: true,
            ..
        })
    ));
}
