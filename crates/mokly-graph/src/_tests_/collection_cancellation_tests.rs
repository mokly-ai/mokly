//! Cancellation stops queued views and retains its typed validation diagnostic.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::collection::ComparisonCollectorMock;
use crate::error::GraphError;
use crate::types::RenderGeneration;

use super::collection_support;

fn assert_cancelled(error: &GraphError) {
    match error {
        GraphError::Attempt { failures, .. } => {
            assert!(!failures.is_empty());
            for failure in failures {
                assert_cancelled(failure);
            }
        }
        GraphError::Runtime { source } => assert_eq!(source.code, RuntimeCode::Cancelled),
        _ => panic!("unexpected error {error}"),
    }
}

#[test]
fn cancellation_during_composition_prevents_the_next_view_and_encoding() {
    let probe = collection_support::probe(4);
    probe.session.render_all().unwrap();
    probe.renders.lock().unwrap().clear();
    probe.options.lock().unwrap().cancel_on = Some("page-000".into());
    let mut collector = Unimock::new(());
    assert_cancelled(
        &probe
            .session
            .collect_comparison(&mut collector)
            .unwrap_err(),
    );
    assert_eq!(*probe.renders.lock().unwrap(), ["page-000"]);
}

#[test]
fn cancellation_during_collection_discards_the_batch_without_starting_another() {
    let probe = collection_support::probe(4);
    probe.session.render_all().unwrap();
    probe.renders.lock().unwrap().clear();
    let cancelled = probe.cancelled.clone();
    let mut collector = Unimock::new(
        ComparisonCollectorMock::collect
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, _, _| {
                cancelled.store(true, Ordering::SeqCst);
                Ok(())
            }))
            .once(),
    );
    assert_cancelled(
        &probe
            .session
            .collect_comparison(&mut collector)
            .unwrap_err(),
    );
    assert_eq!(probe.renders.lock().unwrap().len(), 2);
}
