//! Recorded pool-sized batches release one decoded view after each ordered consumer.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::error::GraphError;
use mokly_model::review::ReviewState;
use mokly_model::runtime_diagnostic::RuntimeCode;

use crate::error::Error;

use super::control::Control;
use super::support::{captured, compare, source};

#[test]
fn concurrent_preparation_keeps_one_pool_sized_batch_and_releases_each_ordered_result() {
    let control = Arc::new(Control {
        overlap: true,
        ..Default::default()
    });
    let result = compare(
        captured(source(1, 4, control.clone()), &[0, 1, 2, 3]),
        source(2, 4, control.clone()),
    )
    .unwrap();
    assert_eq!(*control.batches.lock().unwrap(), [2, 2]);
    assert_eq!(*control.live.lock().unwrap(), [2, 1, 2, 1]);
    assert_eq!(control.live(), 0);
    assert_eq!(result.entries.len(), 1);
    assert_eq!(result.entries[0].documents.len(), 4);
    assert!(
        result.entries[0]
            .documents
            .iter()
            .all(|view| view.state == ReviewState::Unchanged)
    );
    assert_eq!(result.resource_work.reads, 8);
    assert_eq!(result.counts.changes, 0, "{:?}", result.entries);
    assert!(
        !control
            .events
            .lock()
            .unwrap()
            .iter()
            .any(|event| event.starts_with("document:1:"))
    );
    let zero = Arc::new(Control {
        capacity: Some(0),
        overlap: true,
        ..Default::default()
    });
    let result = compare(
        captured(source(1, 2, zero.clone()), &[0, 1]),
        source(2, 2, zero.clone()),
    )
    .unwrap();
    assert_eq!(*zero.batches.lock().unwrap(), [1, 1]);
    assert_eq!(*zero.live.lock().unwrap(), [1, 1]);
    assert_eq!(zero.live(), 0);
    assert_eq!(result.counts.changes, 0);
}

#[test]
fn cancellation_before_batches_and_ordered_views_keeps_each_generations_own_error_on_retained_hits()
{
    for side in [1, 2] {
        for during in 0..3 {
            let control = Arc::new(Control {
                cancellation: AtomicUsize::new(if during == 0 { side } else { 0 }),
                cancel_after_batch: if during == 1 { side } else { 0 },
                cancel_in_view: if during == 2 { side } else { 0 },
                ..Default::default()
            });
            let error = compare(
                captured(source(1, 2, control.clone()), &[0, 1]),
                source(2, 2, control.clone()),
            )
            .unwrap_err();
            let Error::Graph {
                source: GraphError::Runtime { source },
            } = error
            else {
                panic!("expected generation cancellation")
            };
            assert_eq!(source.code, RuntimeCode::Cancelled);
            let expected = side;
            assert_eq!(source.message, format!("cancelled side {expected}"));
            assert_eq!(
                *control.batches.lock().unwrap(),
                if during == 0 { vec![] } else { vec![2] }
            );
            assert_eq!(control.cancellation.load(Ordering::SeqCst), expected);
            assert_eq!(control.live(), 0);
        }
    }
}
