//! Equal content identities retain files but replace retired capture owners.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::types::RenderGenerationMock;
use mokly_model::snapshot::RemovedEntrySnapshot;
use mokly_model::snapshot_records::{EntryRecord, RecordMetadata};
use unimock::{MockFn, Unimock, matching};

use crate::assets::File;
use crate::changes::Accepted;
use crate::clock::ClockMock;
use crate::comparison_capture::CapturerMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, historical_inputs, snapshot};
use crate::error::ServerError;
use crate::publication::FixedPublication;

fn historical() -> Arc<Accepted> {
    let mut value = accepted(Arc::new(Unimock::new(())), Arc::new(Unimock::new(())));
    let result = &mut Arc::get_mut(&mut value).unwrap().result;
    result.snapshot.removed_entries.push(RemovedEntrySnapshot {
        entry: EntryRecord::Page {
            metadata: RecordMetadata {
                path: "sample".into(),
                title: "Sample".into(),
                description: String::new(),
                rationale: None,
                moved_from: None,
                related_docs: Vec::new(),
                source_path: "sample.page.html".into(),
                tags: None,
            },
        },
        folder_titles: Vec::new(),
        parent_title: None,
        snapshot_id: "c".repeat(64),
    });
    result.entries[0].documents[0].before_route = Some("sample/index.html".into());
    value
}

#[tokio::test]
async fn an_identical_replacement_uses_its_live_owner_for_historical_capture() {
    let old = historical();
    let mut next = historical();
    let (catalogue, plans) = historical_inputs();
    Arc::get_mut(&mut next).unwrap().result.before = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
    )));
    let publications = Arc::new(FixedPublication::new(snapshot(Some(next.clone()))));
    let document = "snapshots/before/mokly-generated/sample/index.html";
    let expected = next.clone();
    let store: &dyn Comparisons = &MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(
            CapturerMock::capture
                .next_call(matching!(_, "sample", true, _))
                .answers_arc(Arc::new(move |_, accepted, _, _, _| {
                    assert!(std::ptr::eq(accepted, expected.as_ref()));
                    assert!(!accepted.cancel.cancelled());
                    Ok(BTreeMap::from([(
                        document.into(),
                        File {
                            bytes: "<p>Historical</p>".into(),
                            content_type: "text/html".into(),
                        },
                    )]))
                })),
        )),
        publications,
        Arc::new(Unimock::new(())),
    );
    store.install(old.clone(), files()).unwrap();
    old.cancel.cancel();
    assert!(matches!(
        store.install(old, files()),
        Err(ServerError::ChangesReplaced)
    ));
    store.install(next.clone(), files()).unwrap();
    assert_eq!(
        store.file(&next.id, document).await.unwrap().unwrap().bytes,
        "<p>Historical</p>"
    );
    assert_eq!(
        store
            .file(&next.id, "review.json")
            .await
            .unwrap()
            .unwrap()
            .bytes,
        "{}"
    );
    store.stop().await;
}
