//! Logical targets use the document routes created by the real planning boundary.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_html::composition::{Composed, ComposerMock};
use mokly_html::parse;
use mokly_model::catalogue::ModelEntry;
use mokly_model::usage::CatalogueUsage;
use mokly_source_interface::tree::SourceTreeMock;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::error::GraphError;
use crate::graph::Graph;
use crate::key::NodeKey;
use crate::link_results;
use crate::session::{Session, SessionInput};
use crate::styles::Matchers;
use crate::types::RenderGeneration;
use crate::{planning, validation};

use super::validation_cache_tests::reference;
use super::validation_sharing_tests::sharing;

fn planned() -> Session {
    let source = sharing(false, false, link_results::LIMIT);
    source
        .session
        .comparison_document("target/index.desktop.html")
        .unwrap();
    let state = &source.session.state;
    let mut catalogue = state.catalogue.as_ref().clone();
    let mut page = catalogue.model.entries[2].clone();
    page.metadata.path = "pages".into();
    catalogue.model.entries.truncate(2);
    catalogue.model.entries.push(page.clone());
    let document: ModelEntry = serde_json::from_value(json!({
        "metadata":{"path":"notes","title":"Notes","description":"","tags":[],
            "relatedDocs":[],"isIndex":false,"rootIndex":0,
            "source":{"path":"notes.md","line":1,"column":1}},
        "content":{"kind":"document","colorSchemes":["light","dark"],"resources":[]}
    }))
    .unwrap();
    catalogue.model.entries.push(document);
    catalogue
        .documents
        .insert("notes".into(), "# Summary".into());
    for path in ["target/index", "pages/index"] {
        page.metadata.path = path.into();
        catalogue.model.entries.push(page.clone());
    }
    let graph = Graph {
        inputs: state.inputs.clone(),
        tree: Arc::new(Unimock::new(
            SourceTreeMock::digest
                .each_call(matching!(_))
                .answers(&|_, _| Ok("source".into())),
        )),
        composer: Arc::new(Unimock::new(
            ComposerMock::compose
                .each_call(matching!(_))
                .answers(&|_, request| {
                    Ok(Composed {
                        tree: parse::html(DeliveredHtml::document(
                            if request.entry.metadata.path.ends_with("/index") {
                                "<h1>Child without anchor</h1>"
                            } else {
                                "<h1 id=summary>Target</h1>"
                            },
                        )),
                        usage: CatalogueUsage::Unavailable,
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    })
                }),
        )),
        stylesheets: state.stylesheets.clone(),
        cache: state.cache.clone(),
        workers: state.workers.clone(),
        version: "test".into(),
    };
    let config = state.config.as_ref().clone();
    let matchers = Matchers::new(&config).unwrap();
    let plans = planning::documents(
        &graph,
        &config,
        &catalogue,
        &NodeKey("config".into()),
        &BTreeMap::new(),
        &matchers,
        "",
    )
    .unwrap();
    Session::new(
        &graph,
        SessionInput {
            stylesheet_resolution_files: Default::default(),
            stylesheet_resolution_roots: Default::default(),
            config,
            catalogue,
            plans,
            resources: BTreeMap::new(),
            policy: state.policy.clone(),
            generation_key: "planned".into(),
            matchers,
            directories: vec![],
        },
    )
}

#[test]
fn planned_screen_document_page_and_use_case_targets_keep_anchor_checks_and_route_order() {
    let session = planned();
    for (target, first_route) in [
        ("target", "target/index.desktop.dark.html"),
        ("notes", "notes/index.dark.html"),
        ("pages", "pages/index.html"),
        ("journey", "target/index.desktop.dark.html"),
    ] {
        validation::links(&session, &[reference(target, "summary")]).unwrap();
        let error = validation::links(&session, &[reference(target, "absent")]).unwrap_err();
        let GraphError::Invalid { route, message, .. } = error else {
            panic!("expected missing anchor for {target}")
        };
        assert_eq!(route, "caller/index.desktop.html");
        assert_eq!(
            message,
            format!(
                "caller/index.desktop.html: logical fragment \"absent\" is missing from {first_route}"
            )
        );
    }
    assert!(session.state.anchor_flights.is_empty());
}
