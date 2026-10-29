//! Equal usage completes routes without publishing or invalidating live work.

use std::sync::Arc;

use axum::body::to_bytes;
use mokly_model::canonical;
use mokly_model::namespace::viewer;
use mokly_model::readers;
use mokly_model::usage::CatalogueUsage;
use mokly_model::usage_schemas::UsageSchemas;
use tokio::sync::broadcast::error::TryRecvError;
use unimock::{MockFn, Unimock, matching};

use crate::backend::DocumentsMock;
use crate::detail_encoding::{DetailEncoder, ValidatedDetails};
use crate::evidence::{self, Completion};
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::{ready, snapshot, unrecorded_ready};
use crate::snapshot::encode;

#[test]
fn equal_ready_or_unavailable_usage_is_recorded_without_a_publication() {
    for usage in [ready(), CatalogueUsage::Unavailable] {
        let returned = usage.clone();
        let documents = Unimock::new(
            DocumentsMock::usage
                .next_call(matching!("screen-0/index.mobile.html"))
                .answers_arc(Arc::new(move |_, _| Some(returned.clone()))),
        );
        let pending = snapshot(2, Arc::new(documents.clone()));
        let updates = vec![("screen-0/index.mobile.html".into(), usage.clone())];
        let published = evidence::complete(&pending, &updates, &ValidatedDetails)
            .unwrap()
            .unwrap();
        let mut origin = (*published).clone();
        origin.completed.clear();
        let mut shared = SharedPublication::new(Arc::new(origin.clone()));
        shared.encoder = Arc::new(Unimock::new(()));
        let mut events = shared.subscribe();
        shared.completed(&origin, &updates[0].0).unwrap();
        let next = shared.current();
        assert_eq!(next.index.revision, origin.index.revision);
        assert_eq!(
            encode(&next.index).unwrap().bytes,
            encode(&origin.index).unwrap().bytes
        );
        assert!(Arc::ptr_eq(&next.lease, &origin.lease));
        assert!(origin.lease.valid());
        assert!(Arc::ptr_eq(
            &next.details["screen-0"],
            &origin.details["screen-0"]
        ));
        assert_eq!(next.completed.len(), 1);
        assert!(
            next.completed[&updates[0].0]
                == if matches!(usage, CatalogueUsage::Ready { .. }) {
                    Completion::Ready
                } else {
                    Completion::Unavailable
                }
        );
        shared.completed(&origin, &updates[0].0).unwrap();
        assert!(matches!(
            events.updates.try_recv(),
            Err(TryRecvError::Empty)
        ));
    }
}

#[test]
fn changed_usage_publishes_once_and_expires_the_previous_lease() {
    let documents = Unimock::new(
        DocumentsMock::usage
            .next_call(matching!("screen-0/index.mobile.html"))
            .answers(&|_, _| Some(ready())),
    );
    let origin = snapshot(2, Arc::new(documents.clone()));
    let shared = SharedPublication::new(origin.clone());
    let mut events = shared.subscribe();
    shared
        .completed(&origin, "screen-0/index.mobile.html")
        .unwrap();
    let next = shared.current();
    assert_eq!(next.index.revision, origin.index.revision + 1);
    assert_eq!(next.details["screen-0"].views[0].usage, ready());
    assert!(!origin.lease.valid());
    assert!(next.lease.valid());
    assert_eq!(
        events.updates.try_recv().unwrap().revision,
        next.index.revision
    );
    shared
        .completed(&origin, "screen-0/index.mobile.html")
        .unwrap();
    assert_eq!(shared.current().index.revision, next.index.revision);
    assert!(matches!(
        events.updates.try_recv(),
        Err(TryRecvError::Empty)
    ));
}

#[tokio::test]
async fn usage_completion_reuses_unchanged_detail_bytes_and_ids() {
    let documents = Unimock::new(
        DocumentsMock::usage
            .next_call(matching!("screen-0/index.mobile.html"))
            .answers(&|_, _| Some(ready())),
    );
    let origin = snapshot(2, Arc::new(documents));
    let shared = SharedPublication::new(origin.clone());
    shared
        .completed(&origin, "screen-0/index.mobile.html")
        .unwrap();
    let next = shared.current();
    let changed = &next.details["screen-0"];
    assert_eq!(
        changed.detail_id,
        canonical::detail_id(changed.as_ref()).unwrap()
    );
    assert_eq!(
        next.index
            .screens
            .iter()
            .find(|entry| entry.entry.path == "screen-0")
            .unwrap()
            .entry
            .detail_id,
        changed.detail_id
    );
    let served_index = to_bytes(
        next.files[&viewer("index.json")]
            .response(next.index.revision)
            .into_body(),
        usize::MAX,
    )
    .await
    .unwrap();
    let served_index = readers::index(std::str::from_utf8(&served_index).unwrap()).unwrap();
    assert_eq!(
        served_index
            .screens
            .iter()
            .find(|entry| entry.entry.path == "screen-0")
            .unwrap()
            .entry
            .detail_id,
        changed.detail_id
    );
    assert_ne!(changed.detail_id, origin.details["screen-0"].detail_id);
    assert_eq!(
        next.details["screen-1"].detail_id,
        origin.details["screen-1"].detail_id
    );
    assert!(Arc::ptr_eq(
        &next.details["screen-1"],
        &origin.details["screen-1"]
    ));
    let old_bytes = to_bytes(
        origin.files[&viewer("entries/screen-1.json")]
            .response(origin.index.revision)
            .into_body(),
        usize::MAX,
    )
    .await
    .unwrap();
    let next_bytes = to_bytes(
        next.files[&viewer("entries/screen-1.json")]
            .response(origin.index.revision)
            .into_body(),
        usize::MAX,
    )
    .await
    .unwrap();
    assert_eq!(old_bytes, next_bytes);
}

#[test]
fn equal_completion_is_recorded_at_the_revision_limit() {
    let origin = unrecorded_ready(2, Arc::new(Unimock::new(()))).at_revision(u64::MAX);
    let next = evidence::complete(
        &origin,
        &[("screen-0/index.mobile.html".into(), ready())],
        &ValidatedDetails,
    )
    .unwrap()
    .unwrap();
    assert_eq!(next.index.revision, u64::MAX);
    assert!(next.completed.contains_key("screen-0/index.mobile.html"));
    assert!(Arc::ptr_eq(&next.lease, &origin.lease));
}

#[test]
fn equal_usage_publishes_once_when_it_proves_a_workspace() {
    let documents = Unimock::new(
        DocumentsMock::usage
            .each_call(matching!(_))
            .answers(&|_, _| Some(ready()))
            .n_times(2),
    );
    let mut origin = (*unrecorded_ready(2, Arc::new(documents.clone()))).clone();
    let mut schemas = UsageSchemas::new(&origin.index.components);
    for (path, detail) in &mut origin.details {
        Arc::make_mut(detail).workspace = None;
        origin.files.insert(
            format!("mokly-viewer/entries/{path}.json"),
            ValidatedDetails
                .encode(detail, &origin.index, &mut schemas)
                .unwrap(),
        );
    }
    let origin = Arc::new(origin);
    let shared = SharedPublication::new(origin.clone());
    let mut events = shared.subscribe();
    shared
        .completed(&origin, "screen-0/index.mobile.html")
        .unwrap();
    assert_eq!(shared.current().index.revision, origin.index.revision);
    assert!(origin.lease.valid());
    assert!(matches!(
        events.updates.try_recv(),
        Err(TryRecvError::Empty)
    ));
    shared
        .completed(&origin, "screen-1/index.mobile.html")
        .unwrap();
    let next = shared.current();
    assert_eq!(next.index.revision, origin.index.revision + 1);
    assert_eq!(next.completed.len(), 2);
    assert!(
        next.details
            .values()
            .all(|detail| detail.workspace.is_some())
    );
    assert!(!origin.lease.valid());
    assert_eq!(
        events.updates.try_recv().unwrap().revision,
        next.index.revision
    );
    shared
        .completed(&origin, "screen-1/index.mobile.html")
        .unwrap();
    assert!(matches!(
        events.updates.try_recv(),
        Err(TryRecvError::Empty)
    ));
}
