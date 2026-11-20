//! Completed reads skip admission; native and prepared misses keep their separate owners.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::background::{self, BackgroundMissMock};
use mokly_graph::cache::Artifact;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, Viewport};
use unimock::{MockFn, Unimock, matching};

use crate::backend::{DocumentsMock, GraphDocuments};
use crate::background::Background;
use crate::background_capacity::BackgroundCapacityMock;
use crate::publication_support;
use crate::warnings::TracingWarnings;
use crate::work::{Work, Workers};

use super::script::{pass, reports};
use super::support::route;

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Dispatch {
    Complete(String),
    Native(String),
    Prepared(String),
}

#[tokio::test]
async fn mixed_worker_reads_defer_native_and_prepared_misses_with_fresh_admission() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let reads = Arc::new(AtomicUsize::new(0));
    let artifact = Arc::new(Artifact {
        bytes: vec![],
        content_type: "text/html".into(),
        document: None,
        fragment: None,
    });
    let generation = Unimock::new((
        RenderGenerationMock::plans.each_call(matching!()).returns(
            (0..3)
                .map(|entry| {
                    let route = route(entry);
                    (
                        route.clone(),
                        DocumentPlan {
                            key: NodeKey(route.clone()),
                            resource_key: route.clone(),
                            route,
                            entry,
                            viewport: Some(Viewport::Mobile),
                            color_scheme: ColorScheme::Light,
                            stylesheets: vec![],
                        },
                    )
                })
                .collect::<BTreeMap<_, _>>(),
        ),
        RenderGenerationMock::read_background
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let events = events.clone();
                let reads = reads.clone();
                move |_, path| {
                    if path == route(0) {
                        events.lock().unwrap().push(Dispatch::Complete(path.into()));
                        return Ok(Some(background::BackgroundRead::Complete(artifact.clone())));
                    }
                    let eligible = path == route(2);
                    let path = path.to_owned();
                    let events = events.clone();
                    let reads = reads.clone();
                    let artifact = artifact.clone();
                    let miss = Unimock::new((
                        BackgroundMissMock::root_eligible
                            .each_call(matching!())
                            .returns(eligible),
                        BackgroundMissMock::complete
                            .some_call(matching!(_))
                            .answers_arc(Arc::new(move |_, completion| {
                                assert!(
                                    reads.load(Ordering::SeqCst) > 0,
                                    "a real miss needs fresh batch admission"
                                );
                                assert_eq!(
                                    completion.is_some(),
                                    eligible,
                                    "native misses allocate no Stage"
                                );
                                if let Some(completion) = completion {
                                    completion.handoff(128);
                                }
                                events.lock().unwrap().push(if eligible {
                                    Dispatch::Prepared(path.clone())
                                } else {
                                    Dispatch::Native(path.clone())
                                });
                                Ok(artifact.clone())
                            })),
                    ))
                    .no_verify_in_drop();
                    Ok(Some(background::BackgroundRead::Miss(Box::new(miss))))
                }
            })),
    ));
    let documents = Arc::new(GraphDocuments::new(
        Arc::new(generation),
        Arc::new(Unimock::new(())),
        Arc::new(TracingWarnings),
        Arc::new(Unimock::new(())),
    ));
    let capacity = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let reads = reads.clone();
                move |_| {
                    reads.fetch_add(1, Ordering::SeqCst);
                    2
                }
            })),
    );
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (diagnostics, reported) = reports();
    let (script, mut pass, stopping) = pass(
        publication_support::snapshot(3, documents),
        2,
        work.clone(),
        diagnostics,
        true,
    );
    pass.capacity = Arc::new(capacity);
    pass.run(stopping).await;
    work.stop().await;
    let mut observed = events.lock().unwrap().clone();
    observed.sort();
    assert_eq!(
        observed,
        [
            Dispatch::Complete(route(0)),
            Dispatch::Native(route(1)),
            Dispatch::Prepared(route(2))
        ]
    );
    assert_eq!(
        reads.load(Ordering::SeqCst),
        3,
        "two batch admissions and one eligible completion entry"
    );
    assert_eq!(
        *script.published.lock().unwrap(),
        [vec![route(0), route(1), route(2)]]
    );
    assert!(reported.lock().unwrap().is_empty());
}

#[tokio::test]
async fn a_default_backend_waits_for_fresh_batch_admission_before_ordinary_render() {
    let reads = Arc::new(AtomicUsize::new(0));
    let observations = Arc::new(Mutex::new(Vec::new()));
    let documents = Arc::new(Unimock::new(
        DocumentsMock::background
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let reads = reads.clone();
                let observations = observations.clone();
                move |_, _| {
                    observations
                        .lock()
                        .unwrap()
                        .push(reads.load(Ordering::SeqCst));
                    Ok(Vec::new())
                }
            })),
    ));
    let capacity = Unimock::new(
        BackgroundCapacityMock::capacity
            .each_call(matching!())
            .answers_arc(Arc::new({
                let reads = reads.clone();
                move |_| {
                    reads.fetch_add(1, Ordering::SeqCst);
                    2
                }
            })),
    );
    let work = Arc::new(Workers::new(2, Arc::new(Unimock::new(()))));
    let (_script, mut pass, stopping) = pass(
        publication_support::snapshot(1, documents),
        2,
        work.clone(),
        Arc::new(Unimock::new(())),
        true,
    );
    pass.capacity = Arc::new(capacity);
    pass.run(stopping).await;
    work.stop().await;
    assert_eq!(reads.load(Ordering::SeqCst), 1);
    assert_eq!(*observations.lock().unwrap(), [1]);
}
