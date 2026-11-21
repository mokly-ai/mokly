//! Ordinary reads consume queued faults once and preserve them while disabled.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey};
use mokly_graph::key::NodeKey;
use unimock::Unimock;

use crate::render_store::{CachedDocuments, DocumentBackend};

#[test]
fn ordinary_reads_consume_queued_faults_once_and_preserve_them_while_disabled() {
    let store = CachedDocuments::new(Arc::new(Unimock::new(())), "current".into());
    let key = StoreKey::new(&NodeKey("absent".into()), "build");
    store.index.store(Some(Arc::new(BTreeMap::new())));
    store
        .faults
        .lock()
        .unwrap()
        .extend([EntryFault::Foreign, EntryFault::Damaged]);
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Foreign)
    ));
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Damaged)
    ));
    assert!(matches!(store.load(&key), ReadOutcome::Miss));
    store
        .faults
        .lock()
        .unwrap()
        .push_back(EntryFault::Unreadable);
    store.enabled.store(false, Ordering::Release);
    {
        let _maintenance = store.maintenance.lock().unwrap();
        let _faults = store.faults.lock().unwrap();
        assert!(matches!(store.load(&key), ReadOutcome::Miss));
    }
    store.enabled.store(true, Ordering::Release);
    assert!(matches!(
        store.load(&key),
        ReadOutcome::Rejected(EntryFault::Unreadable)
    ));
}
