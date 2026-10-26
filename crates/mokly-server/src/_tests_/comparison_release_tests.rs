//! Idle delivery files do not extend the lifetime of a replaced base capture.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::clock::ClockMock;
use crate::comparison_capture::CapturerMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{files, historical, historical_inputs, snapshot};
use crate::publication::{PublicationWriter, Publications, SharedPublication};

#[tokio::test]
async fn cached_files_do_not_retain_a_replaced_classification_or_its_base_capture() {
    let mut input = historical();
    let (catalogue, plans) = historical_inputs();
    Arc::get_mut(&mut input).unwrap().result.before = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue)
            .n_times(1),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans)
            .n_times(1),
    )));
    let owner = Arc::downgrade(&input);
    let base = Arc::downgrade(&input.result.before);
    let id = input.id.clone();
    let publications = Arc::new(SharedPublication::new(snapshot(Some(input.clone()))));
    let document = "snapshots/before/mokly-generated/sample/index.html";
    let expected = owner.clone();
    let store = MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            CapturerMock::capture
                .next_call(matching!(_, "sample", true, _))
                .answers_arc(Arc::new(move |_, accepted, _, _, _| {
                    assert!(std::ptr::eq(accepted, expected.upgrade().unwrap().as_ref()));
                    Ok(BTreeMap::from([(
                        document.into(),
                        File {
                            bytes: "<p>Historical</p>".into(),
                            content_type: "text/html".into(),
                        },
                    )]))
                })),
        )),
        publications.clone(),
        Arc::new(Unimock::new(())),
    );
    store.install(input, files()).unwrap();
    {
        let in_flight = publications.current();
        assert!(publications.replace(snapshot(None).at_revision(2)));
        store.collect();
        assert!(owner.upgrade().is_some());
        assert!(base.upgrade().is_some());
        assert!(in_flight.changes.is_some());
        assert_eq!(
            store.file(&id, document).await.unwrap().unwrap().bytes,
            "<p>Historical</p>"
        );
        let tasks = {
            let mut state = store.state.lock().unwrap();
            std::mem::take(&mut state.tasks)
        };
        for task in tasks {
            task.await.unwrap();
        }
    }
    assert!(owner.upgrade().is_none());
    assert!(base.upgrade().is_none());
    for (path, bytes) in [
        ("entries/sample.json", "{}"),
        (document, "<p>Historical</p>"),
    ] {
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
