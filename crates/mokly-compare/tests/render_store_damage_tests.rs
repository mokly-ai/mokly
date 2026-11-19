//! Corruption after index adoption is checked at the selected record boundary.

use std::fs;
use std::sync::Arc;

use mokly_compare::render_store::{CachedDocuments, DocumentBackend, RenderDisk, WriteOutcome};
use mokly_graph::cache::Artifact;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_store::{EntryFault, ReadOutcome, StoreKey, StoredDocument};
use mokly_graph::key::NodeKey;
use mokly_html::composition::Composed;
use mokly_model::usage::CatalogueUsage;

#[path = "render_store_support/mod.rs"]
mod support;

fn record(key: &str) -> StoredDocument {
    let artifact = Artifact {
        bytes: key.as_bytes().to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![],
            usage: CatalogueUsage::Pending,
            warnings: vec![],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    };
    StoredDocument {
        key: StoreKey::new(&NodeKey(key.into()), "native"),
        bytes: EncodedView::encode(&artifact)
            .unwrap()
            .stored(1024 * 1024)
            .unwrap()
            .unwrap(),
    }
}

#[test]
fn a_record_changed_after_index_adoption_is_rejected_before_it_is_restored() {
    for changed_header in [false, true] {
        let temporary = tempfile::tempdir().unwrap();
        let cache = Arc::new(support::cache(
            temporary.path().canonicalize().unwrap().join("cache"),
        ));
        let store = CachedDocuments::new(
            Arc::new(RenderDisk::new(cache.clone(), 1024 * 1024)),
            "current".into(),
        );
        assert_eq!(
            store.save(&[record("a"), record("b")]),
            WriteOutcome::Written(2)
        );
        assert!(matches!(store.load(&record("a").key), ReadOutcome::Hit(_)));
        let entries = cache
            .storage
            .bundle_records(&support::namespace(&cache).join("entries"), 1024 * 1024)
            .unwrap();
        let path = support::data(&cache, &entries[0].key);
        let mut bytes = fs::read(&path).unwrap();
        let mut length = [0; 4];
        length.copy_from_slice(&bytes[8..12]);
        let end = 12 + u32::from_le_bytes(length) as usize;
        if changed_header {
            let mut header: serde_json::Value = serde_json::from_slice(&bytes[12..end]).unwrap();
            header["payloadDigest"] = serde_json::json!("0".repeat(64));
            let changed = serde_json::to_vec(&header).unwrap();
            assert_eq!(changed.len(), end - 12);
            bytes[12..end].copy_from_slice(&changed);
        } else {
            let start = end + record("a").bytes.len() + 128;
            let marker = b"text/html";
            let offset = bytes[start..]
                .windows(marker.len())
                .position(|value| value == marker)
                .unwrap();
            bytes[start + offset + marker.len() - 1] = b'x';
        }
        fs::write(&path, bytes).unwrap();
        if !changed_header {
            let ReadOutcome::Hit(unchanged) = store.load(&record("a").key) else {
                panic!("unrelated record remains checked independently")
            };
            assert_eq!(unchanged.bytes, b"a");
        }
        assert!(matches!(
            store.load(&record("b").key),
            ReadOutcome::Rejected(EntryFault::Damaged)
        ));
        assert!(matches!(store.load(&record("b").key), ReadOutcome::Miss));
    }
}
