//! Retention and authentication use an injected clock and exact byte budgets.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::backend::PreviewDocument;
use crate::clock::ClockMock;
use crate::render_request::Rejection;

use super::{Lookup, MemoryPreviews, PreviewStore};

fn preview(bytes: usize) -> PreviewDocument {
    PreviewDocument {
        files: BTreeMap::from([(
            "index.html".into(),
            File {
                bytes: vec![b'x'; bytes],
                content_type: "text/html; charset=utf-8".into(),
            },
        )]),
        document: "index.html".into(),
        usage: CatalogueUsage::Ready {
            instances: vec![],
            slots: vec![],
            ranges: vec![],
        },
    }
}

#[test]
fn expiry_is_exact_and_foreign_ids_stay_not_found() {
    let clock = Unimock::new((
        ClockMock::milliseconds.next_call(matching!()).returns(0u64),
        ClockMock::milliseconds
            .next_call(matching!())
            .returns(299_999u64),
        ClockMock::milliseconds
            .next_call(matching!())
            .returns(300_000u64),
    ));
    let store: &dyn PreviewStore = &MemoryPreviews::new(Arc::new(clock), "secret".into());
    let result = store.insert(preview(8), &Default::default(), 1).unwrap();
    assert!(matches!(
        store.get(&result.render_id, "index.html"),
        Lookup::File(_)
    ));
    assert!(matches!(
        store.get(&result.render_id, "index.html"),
        Lookup::Expired
    ));
    assert!(matches!(
        store.get("foreign", "index.html"),
        Lookup::Missing
    ));
}

#[test]
fn bundle_count_and_bytes_are_bounded_and_clear_releases_them() {
    let clock = Unimock::new(ClockMock::milliseconds.each_call(matching!()).returns(0u64));
    let store = MemoryPreviews::new(Arc::new(clock), "secret".into());
    let first = store.insert(preview(8), &Default::default(), 1).unwrap();
    for _ in 0..16 {
        store.insert(preview(8), &Default::default(), 1).unwrap();
    }
    assert!(matches!(
        store.get(&first.render_id, "index.html"),
        Lookup::Expired
    ));
    assert_eq!(
        store
            .insert(preview(32 * 1024 * 1024), &Default::default(), 1)
            .unwrap_err(),
        Rejection::Capacity
    );
    store.clear();
    assert_eq!(store.state.lock().unwrap().bytes, 0);
    assert_eq!(store.state.lock().unwrap().bundles.len(), 0);
}
