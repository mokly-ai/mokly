//! Idle delivery files do not extend the lifetime of a replaced base capture.

use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::clock::ClockMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, snapshot};
use crate::publication::{PublicationWriter, Publications, SharedPublication};

#[tokio::test]
async fn cached_files_do_not_retain_a_replaced_classification_or_its_base_capture() {
    let input = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let owner = Arc::downgrade(&input);
    let base = Arc::downgrade(&input.result.before);
    let id = input.id.clone();
    let publications = Arc::new(SharedPublication::new(snapshot(Some(input.clone()))));
    let store = MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        publications.clone(),
        Arc::new(Unimock::new(())),
    );
    let document = "snapshots/before/mokly-generated/sample/index.html";
    let mut retained = files();
    retained.insert(
        document.into(),
        File {
            bytes: "<p>Historical</p>".into(),
            content_type: "text/html".into(),
        },
    );
    store.install(input, retained).unwrap();
    {
        let in_flight = publications.current();
        assert!(publications.replace(snapshot(None).at_revision(2)));
        store.collect();
        assert!(owner.upgrade().is_some());
        assert!(base.upgrade().is_some());
        assert!(in_flight.changes.is_some());
    }
    assert!(owner.upgrade().is_none());
    assert!(base.upgrade().is_none());
    for (path, bytes) in [("review.json", "{}"), (document, "<p>Historical</p>")] {
        assert_eq!(store.file(&id, path).await.unwrap().unwrap().bytes, bytes);
    }
    assert!(
        store
            .file(&id, "snapshots/before/mokly-generated/missing/index.html")
            .await
            .unwrap()
            .is_none()
    );
    store.stop().await;
}
