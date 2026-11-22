//! Prepared in-memory catalogues use the same public projector as Serve.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock};
use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, VisualEntry};
use mokly_model::prop_schema::{JsonType, PropSchema, Types};
use mokly_model::routes;
use unimock::{MockFn, Unimock, matching};

use crate::changes::Accepted;
use crate::comparison_support;
use crate::snapshot::{Projector, SnapshotInput};

pub(crate) fn generation(count: usize, edit: usize) -> Arc<dyn RenderGeneration> {
    graph(count, edit, None, ColorScheme::Light)
}

/// A generation in which only the views of `screen-0` moved to the key of `edit`.
pub(crate) fn narrow(count: usize, edit: usize) -> Arc<dyn RenderGeneration> {
    keyed(count, edit, &|entry| if entry == 0 { edit } else { 0 })
}

/// A generation whose views of each entry have the document key that `key` gives that entry.
pub(crate) fn keyed(
    count: usize,
    edit: usize,
    key: &dyn Fn(usize) -> usize,
) -> Arc<dyn RenderGeneration> {
    graph_with(count, edit, key, None, ColorScheme::Light)
}

pub(crate) fn generation_in_scheme(
    count: usize,
    edit: usize,
    scheme: ColorScheme,
) -> Arc<dyn RenderGeneration> {
    graph(count, edit, None, scheme)
}

fn graph(
    count: usize,
    edit: usize,
    comparison: Option<bool>,
    scheme: ColorScheme,
) -> Arc<dyn RenderGeneration> {
    graph_with(count, edit, &|_| edit, comparison, scheme)
}

fn graph_with(
    count: usize,
    edit: usize,
    key: &dyn Fn(usize) -> usize,
    comparison: Option<bool>,
    scheme: ColorScheme,
) -> Arc<dyn RenderGeneration> {
    let (mut catalogue, _) = comparison_support::historical_inputs();
    catalogue.model.color_schemes = vec![scheme];
    let template = catalogue.model.entries[0].clone();
    catalogue.model.entries = (0..count)
        .map(|number| {
            let mut entry = template.clone();
            entry.metadata.path = format!("screen-{number}");
            entry.metadata.title = format!("Screen {number}: café 😀");
            entry.metadata.description = "A \\\"quoted\\\" value\nwith a tab\tand \\ slash".into();
            entry.metadata.source.path = format!("specs/screen-{number}.html");
            entry.content = EntryContent::Screen {
                visual: VisualEntry {
                    control_order: Vec::new(),
                    color_schemes: vec![scheme],
                    prop_schema: PropSchema {
                        types: Some(Types::Single(JsonType::Object)),
                        properties: Some(BTreeMap::new()),
                        required: Some(Vec::new()),
                        additional_properties: Some(false),
                        ..Default::default()
                    },
                    props: BTreeMap::new(),
                    controls: BTreeMap::new(),
                },
                address: None,
                use_case_paths: Vec::new(),
            };
            entry
        })
        .collect();
    let plans = (0..count)
        .flat_map(|entry| {
            [Viewport::Mobile, Viewport::Desktop].map(|viewport| {
                let route = routes::view(&format!("screen-{entry}"), viewport, scheme);
                (
                    route.clone(),
                    DocumentPlan {
                        route,
                        key: NodeKey(format!("{:064x}", key(entry))),
                        resource_key: "resources".into(),
                        entry,
                        viewport: Some(viewport),
                        color_scheme: scheme,
                        stylesheets: Vec::new(),
                    },
                )
            })
        })
        .collect::<BTreeMap<_, _>>();
    let clauses = (
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(plans),
    );
    let mock = if comparison == Some(true) {
        Unimock::new((
            clauses,
            RenderGenerationMock::comparison_document
                .each_call(matching!(_))
                .answers(&|_, _| Ok(comparison_support::history())),
        ))
    } else if comparison == Some(false) {
        Unimock::new(clauses)
    } else {
        Unimock::new((
            clauses,
            RenderGenerationMock::generation_key
                .each_call(matching!())
                .returns(format!("{edit:064x}")),
        ))
    };
    Arc::new(mock)
}

pub(crate) fn projector() -> Projector {
    Projector {
        deployment_id: "a".repeat(64),
        render_token: "b".repeat(64),
    }
}

pub(crate) fn input(revision: u64) -> SnapshotInput {
    SnapshotInput {
        documents: Arc::new(Unimock::new(())),
        revision,
        config_path: "mokly.config.json".into(),
        base: Some("main".into()),
        assets: BTreeMap::new(),
    }
}

pub(crate) fn accepted(count: usize, edit: usize, settled: bool) -> Arc<Accepted> {
    let graph = graph(count, edit, Some(settled), ColorScheme::Light);
    let mut accepted = comparison_support::accepted(graph.clone(), graph);
    let result = &mut Arc::get_mut(&mut accepted).unwrap().result;
    let classification = result.entries[0].clone();
    let review = result.review.entries[0].clone();
    result.entries = (0..count)
        .map(|number| {
            let mut entry = classification.clone();
            entry.path = format!("screen-{number}");
            entry.documents[0].before_route = Some(format!("screen-{number}/index.mobile.html"));
            entry.documents[0].after_route = entry.documents[0].before_route.clone();
            entry
        })
        .collect();
    result.review.entries = (0..count)
        .map(|number| {
            let mut entry = review.clone();
            entry.path = format!("screen-{number}");
            for side in [entry.before.as_mut(), entry.after.as_mut()]
                .into_iter()
                .flatten()
            {
                side.path = entry.path.clone();
            }
            entry
        })
        .collect();
    result.snapshot.changed_entries = result
        .entries
        .iter()
        .map(|entry| entry.path.clone())
        .collect();
    accepted
}
