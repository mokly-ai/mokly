//! A metadata hint freezes only misses that the ordinary reader can already prove.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use unimock::Unimock;

use crate::render_store::{CachedDocuments, DocumentBackend};

#[test]
fn a_miss_hint_does_no_io_and_preserves_absent_key_faults_and_lock_fallbacks() {
    let store = CachedDocuments::new(Arc::new(Unimock::new(())), "current".into());
    let key = StoreKey::new(&NodeKey("absent".into()), "build");
    assert!(store.known_missing(&key));
    *store.index.lock().unwrap() = Some(BTreeMap::new());
    assert!(store.known_missing(&key));
    {
        let _held = store.index.lock().unwrap();
        assert!(!store.known_missing(&key));
    }
    {
        let _held = store.faults.lock().unwrap();
        assert!(!store.known_missing(&key));
    }
    store
        .faults
        .lock()
        .unwrap()
        .extend([EntryFault::Foreign, EntryFault::Damaged]);
    assert!(!store.known_missing(&key));
    assert!(!store.known_missing(&key));
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Foreign)
    ));
    assert!(!store.known_missing(&key));
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Damaged)
    ));
    assert!(store.known_missing(&key));
    assert!(matches!(store.load(&key), ReadOutcome::Miss));
    store
        .faults
        .lock()
        .unwrap()
        .push_back(EntryFault::Unreadable);
    store.enabled.store(false, Ordering::Release);
    {
        let _index = store.index.lock().unwrap();
        let _faults = store.faults.lock().unwrap();
        assert!(store.known_missing(&key));
        assert!(matches!(store.load(&key), ReadOutcome::Miss));
    }
    store.enabled.store(true, Ordering::Release);
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Unreadable)
    ));
}
