//! Advertised removed metadata survives idle time while snapshots are recaptured.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::snapshot::RemovedEntrySnapshot;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::changes::Accepted;
use crate::clock::ClockMock;
use crate::comparison_capture::{Capturer, CapturerMock, SnapshotCapture};
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, files, historical_inputs, snapshot};
use crate::diagnostics::{Diagnostics, DiagnosticsMock};
use crate::error::ServerError;
use crate::publication::{PublicationWriter, SharedPublication};

const DOCUMENT: &str = "snapshots/before/mokly-generated/sample/index.html";

fn removed(kind: &str, before: Option<Arc<dyn RenderGeneration>>) -> Arc<Accepted> {
    let (catalogue, plans) = historical_inputs();
    let graph = before.unwrap_or_else(|| {
        Arc::new(Unimock::new((
            RenderGenerationMock::catalogue
                .each_call(matching!())
                .returns(catalogue),
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans),
            RenderGenerationMock::render
                .each_call(matching!("sample/index.html"))
                .answers(&|_, _| {
                    Ok(Arc::new(Artifact {
                        bytes: b"<p>History</p>".to_vec(),
                        content_type: "text/html".into(),
                        document: None,
                        fragment: None,
                    }))
                })
                .n_times(2),
            RenderGenerationMock::closure
                .each_call(matching!("sample/index.html"))
                .answers(&|_, _| Ok(Closure::default()))
                .n_times(2),
        )))
    });
    let mut input = accepted(graph, Arc::new(Unimock::new(())));
    let record = serde_json::json!({
        "kind": kind, "path": "sample", "title": "Sample", "description": "",
        "relatedDocs": [], "sourcePath": "sample.html", "colorSchemes": ["light"],
        "propSchema": { "type": "object", "properties": {}, "additionalProperties": false },
        "props": {}, "controls": {}, "slots": [], "suppliedSlots": []
    });
    Arc::get_mut(&mut input)
        .unwrap()
        .result
        .snapshot
        .removed_entries
        .push(RemovedEntrySnapshot {
            entry: serde_json::from_value(record).unwrap(),
            folder_titles: Vec::new(),
            parent_title: None,
            snapshot_id: "b".repeat(64),
        });
    input
}

fn store(
    input: Arc<Accepted>,
    capture: Arc<dyn Capturer>,
    diagnostics: Arc<dyn Diagnostics>,
) -> (MemoryComparisons, Arc<AtomicU64>, Arc<SharedPublication>) {
    let now = Arc::new(AtomicU64::new(0));
    let clock = now.clone();
    let publications = Arc::new(SharedPublication::new(snapshot(Some(input.clone()))));
    let store = MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| clock.load(Ordering::SeqCst))),
        )),
        Arc::new(Unimock::new(())),
        capture,
        publications.clone(),
        diagnostics,
    );
    let mut metadata = files();
    for path in ["entries/sample.json", "previews/sample/index.json"] {
        metadata.insert(path.into(), metadata["review.json"].clone());
    }
    store.install(input, metadata).unwrap();
    (store, now, publications)
}

async fn idle_recovery(kind: &str) {
    let input = removed(kind, None);
    let (store, now, publications) = store(
        input.clone(),
        Arc::new(SnapshotCapture),
        Arc::new(Unimock::new(())),
    );
    let first = store.file(&input.id, DOCUMENT).await.unwrap().unwrap();
    now.store(60_000, Ordering::SeqCst);
    store.collect();
    assert!(
        !store.state.lock().unwrap().bundles[&input.id]
            .files
            .contains_key(DOCUMENT)
    );
    // A HEAD renewal reads the same immutable JSON and retains the same generation URL.
    for path in [
        "review.json",
        "entries/sample.json",
        "previews/sample/index.json",
    ] {
        assert!(store.file(&input.id, path).await.unwrap().is_some());
    }
    assert_eq!(
        store
            .file(&input.id, DOCUMENT)
            .await
            .unwrap()
            .unwrap()
            .bytes,
        first.bytes
    );
    assert!(publications.replace(snapshot(None).at_revision(2)));
    now.store(120_000, Ordering::SeqCst);
    assert!(
        store
            .file(&input.id, "review.json")
            .await
            .unwrap()
            .is_none()
    );
    assert!(store.file(&input.id, DOCUMENT).await.unwrap().is_none());
    store.stop().await;
}

#[tokio::test]
async fn idle_removed_page_preview_recaptures_from_its_retained_base() {
    idle_recovery("page").await;
}

#[tokio::test]
async fn idle_removed_component_renews_the_advertised_generation_and_recaptures() {
    idle_recovery("component").await;
}

#[tokio::test]
async fn historical_capture_failure_reports_exactly_once() {
    let (catalogue, plans) = historical_inputs();
    let graph = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
    )));
    let input = removed("page", Some(graph));
    let (store, _, _) = store(
        input.clone(),
        Arc::new(Unimock::new(
            CapturerMock::capture
                .next_call(matching!(_, "sample", true, _))
                .returns(Err(ServerError::PreviewResource)),
        )),
        Arc::new(Unimock::new(
            DiagnosticsMock::failed
                .next_call(matching!(_))
                .answers(&|_, error| assert!(matches!(error, ServerError::PreviewResource))),
        )),
    );
    assert!(matches!(
        store.file(&input.id, DOCUMENT).await,
        Err(ServerError::ChangesUnavailable)
    ));
    store.stop().await;
}

#[tokio::test(start_paused = true)]
async fn historical_capture_deadline_reports_once_and_drains() {
    let (catalogue, plans) = historical_inputs();
    let graph = Arc::new(Unimock::new((
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
    )));
    let input = removed("page", Some(graph));
    let (entered, entering) = oneshot::channel();
    let entered = Mutex::new(Some(entered));
    let (release, released) = mpsc::channel();
    let released = Mutex::new(released);
    let (store, _, _) = store(
        input.clone(),
        Arc::new(Unimock::new(
            CapturerMock::capture
                .next_call(matching!(_, "sample", true, _))
                .answers_arc(Arc::new(move |_, _, _, _, cancel| {
                    entered
                        .lock()
                        .unwrap()
                        .take()
                        .unwrap()
                        .send(cancel)
                        .unwrap();
                    released.lock().unwrap().recv().unwrap();
                    Err(ServerError::ChangesReplaced)
                })),
        )),
        Arc::new(Unimock::new(
            DiagnosticsMock::failed
                .next_call(matching!(_))
                .answers(&|_, error| assert!(matches!(error, ServerError::Deadline))),
        )),
    );
    let store = Arc::new(store);
    let active = store.clone();
    let request = tokio::spawn(async move { active.file(&input.id, DOCUMENT).await });
    let cancel = entering.await.unwrap();
    tokio::time::advance(Duration::from_millis(9_999)).await;
    assert!(!request.is_finished());
    tokio::time::advance(Duration::from_millis(1)).await;
    assert!(matches!(
        request.await.unwrap(),
        Err(ServerError::ChangesUnavailable)
    ));
    assert!(cancel.cancelled());
    assert!(!store.state.lock().unwrap().tasks[0].is_finished());
    release.send(()).unwrap();
    store.stop().await;
}
