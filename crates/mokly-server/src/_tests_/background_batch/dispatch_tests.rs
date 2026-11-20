//! Mixed catalogues select the owning background path separately for each view.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, Viewport};
use unimock::{MockFn, Unimock, matching};

use crate::backend::GraphDocuments;
use crate::background::Background;
use crate::publication_support;
use crate::warnings::TracingWarnings;
use crate::work::WorkMock;

use super::script::{pass, reports};
use super::support::route;

#[derive(Debug, PartialEq)]
enum Dispatch {
    Ordinary(String),
    Staged(String),
}

#[tokio::test]
async fn mixed_catalogue_dispatches_native_ordinary_and_eligible_staged() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let generation = Unimock::new((
        RenderGenerationMock::plans.each_call(matching!()).returns(
            (0..2)
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
        RenderGenerationMock::can_prepare_root
            .each_call(matching!(_))
            .answers(&|_, path| path == route(1))
            .at_least_times(0),
    ));
    let documents = Arc::new(GraphDocuments::new(
        Arc::new(generation.clone()),
        Arc::new(Unimock::new(())),
        Arc::new(TracingWarnings),
        Arc::new(Unimock::new(())),
    ));
    let work = Unimock::new((
        WorkMock::background
            .each_call(matching!(_, _))
            .answers_arc(Arc::new({
                let events = events.clone();
                move |_, _, route| {
                    events.lock().unwrap().push(Dispatch::Ordinary(route));
                    Ok(vec![])
                }
            }))
            .at_least_times(0),
        WorkMock::background_staged
            .each_call(matching!(_, _, _))
            .answers_arc(Arc::new({
                let events = events.clone();
                move |_, _, route, _| {
                    events.lock().unwrap().push(Dispatch::Staged(route));
                    Ok(vec![])
                }
            }))
            .at_least_times(0),
    ));
    let origin = publication_support::snapshot(2, documents);
    let (diagnostics, reported) = reports();
    let (script, pass, stopping) = pass(origin, 2, Arc::new(work.clone()), diagnostics, true);
    pass.run(stopping).await;
    assert_eq!(
        *events.lock().unwrap(),
        [Dispatch::Ordinary(route(0)), Dispatch::Staged(route(1))]
    );
    assert_eq!(
        *script.published.lock().unwrap(),
        [vec![route(0), route(1)]]
    );
    assert!(reported.lock().unwrap().is_empty());
}
