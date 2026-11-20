//! Head failures and cancelled readers preserve a valid shared base.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::error::{GraphError, InternalError};
use mokly_model::runtime_diagnostic::RuntimeCode;

use crate::error::Error;

use super::harness::Harness;
use super::support::{generation, kept};

#[test]
fn head_failure_and_reader_cancellation_preserve_the_base_for_the_next_classification() {
    for cancel in [false, true] {
        let reads = Arc::new(AtomicUsize::new(0));
        let failure = Arc::new(Mutex::new(None));
        let base = kept(generation(false, reads.clone()), failure.clone());
        let harness = Harness::new(Some(base.clone()), None, true);
        harness.cancelled.store(cancel, Ordering::Release);
        harness.head_failure.store(!cancel, Ordering::Release);
        let error = harness.classify().unwrap_err();
        assert!(
            matches!(
                &error,
                Error::Graph { source: GraphError::Runtime { source } } if cancel && source.code == RuntimeCode::Cancelled
            ) || matches!(
                &error,
                Error::Graph { source: GraphError::Internal(InternalError::Provider { .. }) } if !cancel
            ),
            "cancel={cancel}, error={error}"
        );
        harness.cancelled.store(false, Ordering::Release);
        harness.head_failure.store(false, Ordering::Release);
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
                (0, 0, 0, 0),
                "cancel={cancel}"
            );
            assert!(Arc::ptr_eq(state.slot.as_ref().unwrap(), &base));
            assert_eq!(reads.load(Ordering::Acquire), 1, "cancel={cancel}");
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
}
