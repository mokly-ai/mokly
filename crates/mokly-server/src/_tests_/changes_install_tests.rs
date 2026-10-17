//! Slow ready-state projection must not consume a generation's retention window.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_graph::types::RenderGenerationMock;
use mokly_model::axes::ColorScheme;
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::{oneshot, watch};
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSourceMock, ChangeToken};
use crate::changes_background::{AfterUsage, ChangesPass};
use crate::changes_install::ChangeInstallationMock;
use crate::clock::ClockMock;
use crate::comparison_store::{Comparisons, MemoryComparisons};
use crate::comparison_support::{accepted, historical_inputs, snapshot};
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::empty_model;

#[tokio::test]
async fn ready_metadata_starts_retention_after_projection_finishes() {
    let now = Arc::new(AtomicU64::new(0));
    let owner = Arc::new(Mutex::new(Weak::<MemoryComparisons>::new()));
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = empty_model();
    catalogue.model.color_schemes = vec![ColorScheme::Light];
    let model = Arc::new(catalogue.model.clone());
    let during_projection = now.clone();
    let collecting = owner.clone();
    let graph = Unimock::new((
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .answers_arc(Arc::new(move |mock| {
                during_projection.fetch_add(60_000, Ordering::SeqCst);
                let store = collecting.lock().unwrap().upgrade();
                if let Some(store) = store {
                    store.collect();
                }
                mock.make_ref(catalogue.clone())
            })),
    ));
    let input = accepted(Arc::new(graph.clone()), Arc::new(graph.clone()));
    let mut result = Arc::try_unwrap(input).ok().unwrap().result;
    result.entries.clear();
    result.review.entries.clear();
    result.snapshot.changed_entries.clear();
    let (finished, finishing) = oneshot::channel();
    let finished = Mutex::new(Some(finished));
    let source = Unimock::new((
        ChangeSourceMock::references
            .next_call(matching!(_))
            .returns(Ok("refs".into())),
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Ok(result)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, result, _| {
                finished
                    .lock()
                    .unwrap()
                    .take()
                    .unwrap()
                    .send(result.err().map(ToString::to_string))
                    .unwrap();
            })),
    ));
    let mut origin = (*snapshot(None)).clone();
    let generation = Arc::make_mut(&mut origin.generation);
    generation.model = model;
    generation.changes = Some(Arc::new(source.clone()));
    let origin = Arc::new(origin);
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let clock = now.clone();
    let store = Arc::new(MemoryComparisons::new(
        Arc::new(Unimock::new(
            ClockMock::milliseconds
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| clock.load(Ordering::SeqCst))),
        )),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        publications.clone(),
        Arc::new(Unimock::new(())),
    ));
    *owner.lock().unwrap() = Arc::downgrade(&store);
    let pass: Arc<dyn AfterUsage> = Arc::new(ChangesPass {
        publications: publications.clone(),
        comparisons: store.clone(),
        diagnostics: Arc::new(Unimock::new(())),
        watching: false,
    });
    let (stop, stopping) = watch::channel(false);
    let run = tokio::spawn(async move { pass.run(origin, stopping).await });
    let failure = finishing.await.unwrap();
    stop.send_replace(true);
    run.await.unwrap();
    assert_eq!(failure, None);
    let current = publications.current();
    assert_eq!(current.index.changes_status, ChangesStatus::Ready);
    let id = &current.changes.as_ref().unwrap().id;
    let file = store.file(id, "review.json").await.unwrap();
    assert!(now.load(Ordering::SeqCst) >= 60_000);
    store.stop().await;
    assert!(
        file.is_some(),
        "the newly advertised generation already expired"
    );
}

#[test]
fn rejected_metadata_installation_publishes_no_pointer_or_event() {
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = empty_model();
    catalogue.model.color_schemes = vec![ColorScheme::Light];
    let model = Arc::new(catalogue.model.clone());
    let graph = Unimock::new((
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    ));
    let mut input = accepted(Arc::new(graph.clone()), Arc::new(graph.clone()));
    let result = &mut Arc::get_mut(&mut input).unwrap().result;
    result.entries.clear();
    result.review.entries.clear();
    result.snapshot.changed_entries.clear();
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).model = model;
    let origin = Arc::new(origin);
    let publications = SharedPublication::new(origin.clone());
    let mut updates = publications.subscribe().updates;
    let installation = Unimock::new(
        ChangeInstallationMock::install
            .next_call(matching!())
            .returns(Err(ServerError::ComparisonCapacity)),
    );
    let result = publications.changes(
        &origin,
        ChangesStatus::Ready,
        Some(input),
        &ChangeToken::default(),
        Some(&installation),
    );
    assert!(matches!(result, Err(ServerError::ComparisonCapacity)));
    assert!(Arc::ptr_eq(&origin, &publications.current()));
    assert!(matches!(
        updates.try_recv(),
        Err(tokio::sync::broadcast::error::TryRecvError::Empty)
    ));
}
