//! Frozen misses share the ordinary read's state record and tracing boundary.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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
fn a_frozen_miss_counts_and_traces_once_and_declined_hints_change_nothing() {
    let absent = Arc::new(AtomicBool::new(false));
    let missing = absent.clone();
    let key = StoreKey::new(&NodeKey("document".into()), "build");
    let expected = key.clone();
    let loads = Arc::new(AtomicUsize::new(0));
    let observed_loads = loads.clone();
    let backend = Arc::new(Unimock::new((
        DocumentBackendMock::known_missing
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                assert_eq!(actual, &expected);
                missing.load(Ordering::Acquire)
            })),
        DocumentBackendMock::load
            .some_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                observed_loads.fetch_add(1, Ordering::AcqRel);
                ReadOutcome::Miss
            })),
    )));
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
        assert!(!store.try_miss(&key));
        assert_eq!(store.stats(), initial);
        absent.store(true, Ordering::Release);
        {
            let _held = store.shared.pending.lock().unwrap();
            assert!(!store.try_miss(&key));
        }
        {
            let _held = store.shared.publication.lock().unwrap();
            assert!(!store.try_miss(&key));
        }
        assert_eq!(store.stats(), initial);
        assert_eq!(trace.closed("render.store.read").len(), 0);
        assert_eq!(loads.load(Ordering::Acquire), 0);
        assert!(store.try_miss(&key));
        let hinted = store.stats();
        assert_eq!(
            (hinted.hits, hinted.misses, hinted.faults, hinted.sequence),
            (0, 1, 0, initial.sequence + 1)
        );
        assert_eq!(*states.lock().unwrap(), [initial, hinted]);
        assert_eq!(trace.closed("render.store.read").len(), 1);
        assert_eq!(loads.load(Ordering::Acquire), 0);
        assert!(matches!(store.load(&key), ReadOutcome::Miss));
        let loaded = store.stats();
        assert_eq!(
            (loaded.hits, loaded.misses, loaded.faults, loaded.sequence),
            (0, 2, 0, initial.sequence + 2)
        );
        assert_eq!(*states.lock().unwrap(), [initial, hinted, loaded]);
        assert_eq!(trace.closed("render.store.read").len(), 2);
        assert_eq!(loads.load(Ordering::Acquire), 1);
    });
    store.shutdown();
}
