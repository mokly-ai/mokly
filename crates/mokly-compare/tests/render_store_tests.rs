//! Durable complete documents survive a new store and reject foreign or damaged entries.

use std::fs;
use std::sync::{Arc, Barrier, Mutex, mpsc};
use std::thread;

use mokly_compare::bundle_cache_types::{Mutation, RawRead};
use mokly_compare::render_store::{
    CachedDocuments, DocumentBackend, RenderDisk, SegmentCache, WriteOutcome,
};
use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey, StoredDocument};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;
use mokly_sidecar::bundle_outcomes::SkipReason;

#[path = "render_store_support/mod.rs"]
mod support;

#[path = "bundle_store_support/paused.rs"]
mod paused;

fn record(key: &str) -> StoredDocument {
    let artifact = Artifact {
        bytes: b"exact\0document\xff".to_vec(),
        content_type: "text/html; charset=utf-8".into(),
        fragment: None,
        document: Some(Composed {
            tree: Vec::new(),
            usage: CatalogueUsage::Ready {
                instances: vec![],
                slots: vec![],
                ranges: vec![],
            },
            warnings: vec![],
            resources: vec!["asset.svg".into()],
            components: vec!["card".into()],
            links: vec![],
        }),
    };
    StoredDocument {
        key: StoreKey::new(&NodeKey(key.into()), "native-build"),
        bytes: EncodedView::encode(&artifact)
            .unwrap()
            .stored(1024 * 1024)
            .unwrap()
            .unwrap_or_default(),
    }
}

#[test]
fn reopening_repairs_a_stale_access_counter_before_evicting_recent_segments() {
    let temporary = tempfile::tempdir().unwrap();
    let cache = Arc::new(support::cache(
        temporary.path().canonicalize().unwrap().join("cache"),
    ));
    let first = CachedDocuments::new(
        Arc::new(RenderDisk::new(cache.clone(), 1024 * 1024)),
        "current".into(),
    );
    assert_eq!(first.save(&[record("a")]), WriteOutcome::Written(1));
    assert_eq!(first.save(&[record("b")]), WriteOutcome::Written(1));
    assert!(matches!(first.load(&record("a").key), ReadOutcome::Hit(_)));
    let entries = cache
        .storage
        .bundle_records(&support::namespace(&cache).join("entries"), 1024 * 1024)
        .unwrap();
    let bound = entries.iter().map(|record| record.bytes).sum();
    fs::write(
        support::namespace(&cache).join("access"),
        0u64.to_le_bytes(),
    )
    .unwrap();
    drop(first);
    let reopened = CachedDocuments::new(
        Arc::new(RenderDisk::new(cache.clone(), bound)),
        "current".into(),
    );
    assert_eq!(reopened.save(&[record("c")]), WriteOutcome::Written(1));
    assert_eq!(reopened.save(&[record("d")]), WriteOutcome::Written(1));
    assert!(
        matches!(reopened.load(&record("c").key), ReadOutcome::Hit(_)),
        "recent segment C must survive a stale counter"
    );
    assert!(matches!(
        reopened.load(&record("d").key),
        ReadOutcome::Hit(_)
    ));
    assert!(matches!(reopened.load(&record("a").key), ReadOutcome::Miss));
    let retained = cache
        .storage
        .bundle_records(&support::namespace(&cache).join("entries"), bound)
        .unwrap();
    assert_eq!(
        retained.iter().map(|record| record.bytes).sum::<u64>(),
        bound
    );
}

#[test]
fn damaged_and_foreign_segments_are_misses_and_are_retired() {
    for (foreign, expected) in [(false, EntryFault::Damaged), (true, EntryFault::Foreign)] {
        let temporary = tempfile::tempdir().unwrap();
        let cache = Arc::new(support::cache(
            temporary.path().canonicalize().unwrap().join("cache"),
        ));
        let store = CachedDocuments::new(
            Arc::new(RenderDisk::new(cache.clone(), 1024 * 1024)),
            "current".into(),
        );
        assert_eq!(store.save(&[record("a")]), WriteOutcome::Written(1));
        let entries = cache
            .storage
            .bundle_records(&support::namespace(&cache).join("entries"), 1024 * 1024)
            .unwrap();
        let data = support::data(&cache, &entries[0].key);
        let mut bytes = fs::read(&data).unwrap();
        let original_len = bytes.len();
        let mut length = [0; 4];
        length.copy_from_slice(&bytes[8..12]);
        let end = 12 + u32::from_le_bytes(length) as usize;
        let mut header: serde_json::Value = serde_json::from_slice(&bytes[12..end]).unwrap();
        if foreign {
            header["formatVersion"] = serde_json::json!(2);
        } else {
            header["payloadDigest"] = serde_json::json!("0".repeat(64));
        }
        let mut changed = bytes[..12].to_vec();
        changed.extend_from_slice(&serde_json::to_vec(&header).unwrap());
        changed.extend_from_slice(&bytes.split_off(end));
        assert_eq!(changed.len(), original_len);
        fs::write(&data, changed).unwrap();
        assert!(
            matches!(store.load(&record("a").key), ReadOutcome::Rejected(fault) if fault == expected)
        );
        assert!(matches!(store.load(&record("a").key), ReadOutcome::Miss));
        assert_eq!(
            cache
                .storage
                .bundle_records(&support::namespace(&cache).join("entries"), 1024 * 1024)
                .unwrap()
                .len(),
            0
        );
    }
}

#[test]
fn concurrent_segment_writers_never_publish_partial_data_and_preserve_newer_tokens() {
    let temporary = tempfile::tempdir().unwrap();
    let mut cache = support::cache(temporary.path().canonicalize().unwrap().join("cache"));
    let (ready, waiting) = mpsc::channel();
    let resume = Arc::new(Barrier::new(2));
    cache.storage = Arc::new(paused::PausedStorage {
        inner: cache.storage.clone(),
        ready: Mutex::new(Some(ready)),
        resume: resume.clone(),
    });
    let cache = Arc::new(cache);
    let disk = Arc::new(RenderDisk::new(cache.clone(), 1024 * 1024));
    let store = Arc::new(CachedDocuments::new(disk.clone(), "current".into()));
    let writing = store.clone();
    let writer = thread::spawn(move || writing.save(&[record("a")]));
    waiting.recv().unwrap();
    let stages = cache
        .storage
        .stages(&support::namespace(&cache).join("staging"))
        .unwrap();
    assert_eq!(stages.len(), 1);
    assert!(matches!(disk.read(&stages[0]).unwrap(), RawRead::Contended));
    assert_eq!(store.save(&[record("a")]), WriteOutcome::Skipped);
    assert!(matches!(store.load(&record("a").key), ReadOutcome::Miss));
    assert!(
        !writer.is_finished(),
        "the partial write remains at its explicit barrier"
    );
    resume.wait();
    assert_eq!(writer.join().unwrap(), WriteOutcome::Written(1));
    assert!(matches!(store.load(&record("a").key), ReadOutcome::Hit(_)));
    let old = match disk.read(&stages[0]).unwrap() {
        RawRead::Entry(entry) => entry.token,
        _ => panic!("published segment"),
    };
    let bytes = fs::read(support::data(&cache, &stages[0])).unwrap();
    assert_eq!(disk.replace(&stages[0], &bytes).unwrap(), Mutation::Written);
    assert_eq!(
        disk.invalidate(&stages[0], Some(old)).unwrap(),
        Mutation::Skipped(SkipReason::Changed)
    );
    assert!(
        matches!(store.load(&record("a").key), ReadOutcome::Hit(_)),
        "a newer complete publication stays usable after full validation"
    );
}

#[test]
fn durable_restart_keeps_document_bytes_and_changed_keys_miss() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().canonicalize().unwrap().join("cache");
    let first = CachedDocuments::new(
        Arc::new(RenderDisk::new(
            Arc::new(support::cache(root.clone())),
            1024 * 1024,
        )),
        "current".into(),
    );
    let document = record("a");
    assert_eq!(first.save(&[document]), WriteOutcome::Written(1));
    drop(first);
    let second = CachedDocuments::new(
        Arc::new(RenderDisk::new(Arc::new(support::cache(root)), 1024 * 1024)),
        "current".into(),
    );
    let original = record("a");
    let ReadOutcome::Hit(artifact) = second.load(&original.key) else {
        panic!("new store must read durable bytes")
    };
    assert_eq!(artifact.bytes, b"exact\0document\xff");
    assert_eq!(artifact.content_type, "text/html; charset=utf-8");
    assert_eq!(artifact.document.as_ref().unwrap().resources, ["asset.svg"]);
    assert!(matches!(
        second.load(&record("changed").key),
        ReadOutcome::Miss
    ));
    assert!(matches!(
        second.load(&StoreKey::new(&NodeKey("a".into()), "other-native-build")),
        ReadOutcome::Miss
    ));
}
