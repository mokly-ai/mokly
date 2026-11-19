//! Real staged evidence proves Source admits only its successful publication callback.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_compare::comparison::Engine;
use mokly_compare::comparison_reuse::ReuseAttempt;
use mokly_compare::comparison_types::{ComparisonRequest, ComparisonResult};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_proof::{ComparisonRead, DocumentProof, ProofMode, content_identity};
use mokly_graph::key::{NodeKind, key};
use mokly_graph::types::{DocumentPlan, RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_html::{composition::Composed, parse};
use mokly_model::axes::ColorScheme;
use mokly_model::usage::CatalogueUsage;
use mokly_server::changes::ChangeSource;
use mokly_server::error::ServerError;
use serde_json::json;
use unimock::{MockFn, Unimock, matching};

use crate::serve_changes::Source;
use crate::warning_support::catalogue;

pub(super) fn checks_ready_admission_and_failed_or_cancelled_staging(source: &Source) {
    let original = generation("<p>original</p>");
    let staged = source.comparison_attempt();
    let result = classify(staged.as_ref(), &original);
    let probe = || {
        source
            .services
            .reuse
            .begin(engine(), source.comparison_fence())
    };
    let unaccepted = probe();
    classify(unaccepted.as_ref(), &original);
    assert_eq!(
        (unaccepted.work().reused, unaccepted.work().compared),
        (0, 1)
    );
    unaccepted.discard();
    source.finished(Ok(&result), Duration::ZERO);
    let accepted = probe();
    classify(accepted.as_ref(), &original);
    assert_eq!((accepted.work().reused, accepted.work().compared), (1, 0));
    accepted.discard();

    let failed = source.comparison_attempt();
    classify(failed.as_ref(), &generation("<p>failed publication</p>"));
    source.finished(
        Err(&ServerError::ComparisonMetadataTooLarge),
        Duration::ZERO,
    );
    let after_failure = probe();
    classify(after_failure.as_ref(), &original);
    assert_eq!(
        (after_failure.work().reused, after_failure.work().compared),
        (1, 0)
    );
    after_failure.discard();

    let cancelled = source.comparison_attempt();
    classify(
        cancelled.as_ref(),
        &generation("<p>cancelled publication</p>"),
    );
    source.discarded();
    assert!(source.staging.lock().unwrap().is_none());
    let after_cancellation = probe();
    classify(after_cancellation.as_ref(), &original);
    assert_eq!(
        (
            after_cancellation.work().reused,
            after_cancellation.work().compared
        ),
        (1, 0)
    );
    cancelled.discard();
}

fn engine() -> Engine {
    Engine {
        moves: Arc::new(Detector),
        css: Arc::new(MemoryParsedCss::new(4096)),
    }
}

fn classify(attempt: &dyn ReuseAttempt, generation: &Unimock) -> ComparisonResult {
    attempt
        .compare_prepared(
            &ComparisonRequest {
                base_ref: "base".into(),
                base_commit: "b".repeat(40),
                catalogue_identity: "c".repeat(64),
            },
            Arc::new(generation.clone()),
            Arc::new(generation.clone()),
        )
        .unwrap()
}

fn generation(html: &'static str) -> Unimock {
    let mut catalogue = catalogue(vec![]);
    catalogue.model.entries.push(serde_json::from_value(json!({
        "metadata":{"path":"sample","title":"Sample","description":"","tags":[],"relatedDocs":[],"isIndex":false,"rootIndex":0,"source":{"path":"sample.page.html","line":1,"column":1}},
        "content":{"kind":"page"}
    })).unwrap());
    let route = mokly_model::routes::document("sample", ColorScheme::Light);
    let generation = Unimock::new((
        RenderGenerationMock::comparison_document_proof
            .each_call(matching!(_))
            .answers(&|source, route| {
                let artifact = source.comparison_document(route).ok()?;
                let identity = source.comparison_identity(
                    ComparisonRead::Document,
                    route,
                    ProofMode::Current,
                )?;
                Some(DocumentProof {
                    identity,
                    usage: artifact
                        .document
                        .as_ref()
                        .map(|document| document.usage.clone()),
                })
            }),
        RenderGenerationMock::catalogue
            .each_call(matching!())
            .returns(catalogue),
        RenderGenerationMock::plans
            .each_call(matching!())
            .returns(BTreeMap::from([(
                route.clone(),
                DocumentPlan {
                    resource_key: "sample".into(),
                    route,
                    key: key(NodeKind::Document, &[html.as_bytes()]),
                    entry: 0,
                    viewport: None,
                    color_scheme: ColorScheme::Light,
                    stylesheets: vec![],
                },
            )])),
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers(&|_| Ok(())),
        RenderGenerationMock::render_all
            .each_call(matching!())
            .answers(&|_| Ok(RenderSummary::default())),
        RenderGenerationMock::comparison_document
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                Ok(Arc::new(Artifact {
                    bytes: html.as_bytes().into(),
                    content_type: "text/html".into(),
                    fragment: None,
                    document: Some(Composed {
                        tree: parse::html(DeliveredHtml::document(html)),
                        usage: CatalogueUsage::Ready {
                            instances: vec![],
                            slots: vec![],
                            ranges: vec![],
                        },
                        warnings: vec![],
                        resources: vec![],
                        components: vec![],
                        links: vec![],
                    }),
                }))
            })),
        RenderGenerationMock::closure
            .each_call(matching!(_))
            .answers(&|_, _| Ok(Closure::default())),
        RenderGenerationMock::comparison_identity
            .each_call(matching!(_, _, _))
            .returns(Some(content_identity(html.as_bytes()))),
    ));
    if let Some(route) = generation.plans().keys().next() {
        let _ = generation.comparison_document_proof(route);
    }
    generation
}
