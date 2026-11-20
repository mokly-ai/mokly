//! Each ordinary miss records one consumed store outcome and tracing boundary.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::cache::MemoryCache;
use mokly_graph::document_store::{DocumentStore, ReadOutcome, StoreKey, StoreStats};
use mokly_graph::key::NodeKey;
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::render_pending::StoreObserverMock;
use crate::render_store::DocumentBackendMock;
use crate::render_writer::{DocumentWriter, WriterLimits};

#[test]
fn ordinary_misses_count_and_trace_each_consumed_outcome_once() {
    let key = StoreKey::new(&NodeKey("document".into()), "build");
    let expected = key.clone();
    let loads = Arc::new(AtomicUsize::new(0));
    let observed_loads = loads.clone();
    let backend = Arc::new(Unimock::new(
        DocumentBackendMock::load
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                assert_eq!(actual, &expected);
                observed_loads.fetch_add(1, Ordering::AcqRel);
                ReadOutcome::Miss
            })),
    ));
    let states = Arc::new(Mutex::new(Vec::<StoreStats>::new()));
    let captured = states.clone();
    let observer = Arc::new(Unimock::new(
        StoreObserverMock::state
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, stats| {
                captured.lock().unwrap().push(stats)
            })),
    ));
    let store = DocumentWriter::observed(
        backend,
        Arc::new(MemoryCache::new(0, 0)),
        WriterLimits::default(),
        observer,
    );
    let initial = store.stats();
    let trace = Trace::default();
    trace.in_scope(|| {
        assert_eq!(store.stats(), initial);
        assert_eq!(trace.closed("render.store.read").len(), 0);
        assert_eq!(loads.load(Ordering::Acquire), 0);
        assert!(matches!(store.load(&key), ReadOutcome::Miss));
        let first = store.stats();
        assert_eq!(
            (first.hits, first.misses, first.faults, first.sequence),
            (0, 1, 0, initial.sequence + 1)
        );
        assert_eq!(*states.lock().unwrap(), [initial, first]);
        assert_eq!(trace.closed("render.store.read").len(), 1);
        assert_eq!(loads.load(Ordering::Acquire), 1);
        assert!(matches!(store.load(&key), ReadOutcome::Miss));
        let second = store.stats();
        assert_eq!(
            (second.hits, second.misses, second.faults, second.sequence),
            (0, 2, 0, initial.sequence + 2)
        );
        assert_eq!(*states.lock().unwrap(), [initial, first, second]);
        assert_eq!(trace.closed("render.store.read").len(), 2);
        assert_eq!(loads.load(Ordering::Acquire), 2);
    });
    store.shutdown();
}
