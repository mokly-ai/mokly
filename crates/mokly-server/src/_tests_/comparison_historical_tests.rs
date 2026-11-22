//! Historical routes follow base plans even when classification omits a document.

use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::snapshot::RemovedEntrySnapshot;
use mokly_model::snapshot_records::{EntryRecord, RecordMetadata};
use unimock::{MockFn, Unimock, matching};

use crate::clock::ClockMock;
use crate::comparison_capture::SnapshotCapture;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, historical_inputs, snapshot};
use crate::publication::FixedPublication;

#[tokio::test]
async fn removed_documents_use_base_plans_without_classified_document_records() {
    let (catalogue, plans) = historical_inputs();
    let graph = Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
        RenderGenerationMock::render
            .next_call(matching!("sample/index.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: b"<p>History</p>".to_vec(),
                content_type: "text/html".into(),
                document: None,
                fragment: None,
            }))),
        RenderGenerationMock::closure
            .next_call(matching!("sample/index.html"))
            .returns(Ok(Closure::default())),
    ));
    let mut accepted = accepted(Arc::new(graph.clone()), Arc::new(Unimock::new(())));
    let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
    result.entries[0].documents.clear();
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
    let store: &dyn Comparisons = &MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds.each_call(matching!()).returns(0u64),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(SnapshotCapture),
        Arc::new(FixedPublication::new(snapshot(None))),
        Arc::new(Unimock::new(())),
    );
    store.install(accepted.clone(), files()).unwrap();
    let file = store
        .file(
            &accepted.id,
            "snapshots/before/mokly-generated/sample/index.html",
        )
        .await
        .unwrap();
    assert_eq!(file.unwrap().bytes, "<p>History</p>");
    store.stop().await;
}
