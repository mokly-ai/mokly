//! A full selected store delays metadata installation without repeating classification.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_graph::types::RenderGenerationMock;
use mokly_model::axes::ColorScheme;
use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use crate::changes::{ChangeSourceMock, ChangeToken};
use crate::changes_background::ChangesPass;
use crate::comparison_store::ComparisonsMock;
use crate::comparison_support::{accepted, historical_inputs, snapshot};
use crate::error::ServerError;
use crate::publication::{Publications, SharedPublication};
use crate::publication_support::empty_model;

#[tokio::test(start_paused = true)]
async fn selected_capacity_retries_the_same_ready_metadata_after_collection() {
    let (mut catalogue, _) = historical_inputs();
    catalogue.model = empty_model();
    catalogue.model.color_schemes = vec![ColorScheme::Light];
    let model = Arc::new(catalogue.model.clone());
    let graph = Arc::new(Unimock::new((
        RenderGenerationMock::generation_key
            .each_call(matching!())
            .returns("after"),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::new()),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
    )));
    let mut input = accepted(graph.clone(), graph);
    let result = &mut Arc::get_mut(&mut input).unwrap().result;
    result.entries.clear();
    result.review.entries.clear();
    result.snapshot.changed_entries.clear();
    let result = Arc::try_unwrap(input).ok().unwrap().result;
    let source = Arc::new(Unimock::new((
        ChangeSourceMock::classify
            .next_call(matching!(_, _))
            .returns(Ok(result)),
        ChangeSourceMock::finished
            .next_call(matching!(_, _))
            .answers(&|_, result, _| {
                assert!(result.is_ok());
            }),
    )));
    let (rejected, rejecting) = oneshot::channel();
    let rejected = Mutex::new(Some(rejected));
    let identity = Arc::new(Mutex::new(None));
    let first = identity.clone();
    let store = Arc::new(Unimock::new((
        ComparisonsMock::install
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, accepted, files| {
                *first.lock().unwrap() =
                    Some((accepted.id.clone(), files["review.json"].bytes.clone()));
                rejected.lock().unwrap().take().unwrap().send(()).unwrap();
                Err(ServerError::ComparisonCapacity)
            })),
        ComparisonsMock::install
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, accepted, files| {
                assert_eq!(
                    *identity.lock().unwrap(),
                    Some((accepted.id.clone(), files["review.json"].bytes.clone()))
                );
                Ok(())
            })),
    )));
    let mut origin = (*snapshot(None)).clone();
    Arc::make_mut(&mut origin.generation).model = model;
    let origin = Arc::new(origin);
    let publications = Arc::new(SharedPublication::new(origin.clone()));
    let pass = ChangesPass {
        publications: publications.clone(),
        comparisons: store,
        diagnostics: Arc::new(Unimock::new(())),
        watching: false,
    };
    let run = tokio::spawn(async move {
        pass.execute(
            origin,
            source,
            Arc::new(ChangeToken::default()),
            Ok("base".into()),
        )
        .await;
    });
    rejecting.await.unwrap();
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Pending
    );
    tokio::time::advance(Duration::from_secs(1)).await;
    run.await.unwrap();
    assert_eq!(
        publications.current().index.changes_status,
        ChangesStatus::Ready
    );
}
