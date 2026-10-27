//! Build preparation keeps a bounded head capture or its source fallback.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::preparation::CatalogueBuilderMock;
use mokly_compare::base_render::ChangesServiceMock;
use mokly_graph::cache::Artifact;
use mokly_graph::types::{
    ComparisonCapture, GraphFactory, GraphFactoryMock, RenderGeneration, RenderGenerationMock,
    RenderGraph, RenderGraphMock, RenderSummary,
};
use unimock::{Clause, MockFn, Unimock, matching};

use crate::build::{BuildService, CatalogueBuild};
use crate::cancellation::BuildCancellation;

use super::build_tests::{config, options, prepared};

fn captured_head(generation: Arc<dyn RenderGeneration>) -> impl Clause {
    ChangesServiceMock::capture_head
        .next_call(matching!(_))
        .returns(Ok(generation))
}

fn graph_for(generation: Arc<dyn RenderGeneration>) -> (Arc<dyn GraphFactory>, Vec<Unimock>) {
    let graph_mock = Unimock::new(
        RenderGraphMock::prepare
            .next_call(matching!(_, _, _))
            .returns(Ok(generation)),
    );
    let graph: Arc<dyn RenderGraph> = Arc::new(graph_mock.clone());
    let factory = Unimock::new(
        GraphFactoryMock::create
            .next_call(matching!(_))
            .returns(Ok(graph)),
    );
    (Arc::new(factory.clone()), vec![graph_mock, factory])
}

#[test]
fn prepare_keeps_the_captured_head_for_later_render_reads() {
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
    ));
    let builder = Arc::new(Unimock::new(
        CatalogueBuilderMock::prepare
            .next_call(matching!(_, _))
            .returns(Ok(prepared(Vec::new()))),
    ));
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let captured = Arc::new(Unimock::new((
        RenderGenerationMock::comparison_capture
            .each_call(matching!())
            .returns(Some(ComparisonCapture {
                source: source.clone(),
                views: 4,
                retained_bytes: 128,
                encoded_bytes: 64,
            })),
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: 4,
                ..Default::default()
            })),
        RenderGenerationMock::render
            .next_call(matching!("home/index.html"))
            .returns(Ok(Arc::new(Artifact {
                bytes: b"captured head".to_vec(),
                document: None,
                fragment: None,
                content_type: "text/html".into(),
            }))),
    )));
    let (graphs, _guards) = graph_for(source);
    let service: &dyn BuildService = &CatalogueBuild {
        changes: Arc::new(Unimock::new(captured_head(
            captured.clone() as Arc<dyn RenderGeneration>
        ))),
        inputs: None,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        config: loader,
        catalogue: builder,
        graphs,
    };
    let prepared = service.prepare(Path::new("/repo"), &options()).unwrap();
    assert_eq!(prepared.summary.documents, 4);
    assert_eq!(prepared.generation.comparison_capture().unwrap().views, 4);
    assert_eq!(
        prepared.generation.render("home/index.html").unwrap().bytes,
        b"captured head"
    );
}

#[test]
fn prepare_passes_the_captured_head_to_classify() {
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
    ));
    let builder = Arc::new(Unimock::new(
        CatalogueBuilderMock::prepare
            .next_call(matching!(_, _))
            .returns(Ok(prepared(Vec::new()))),
    ));
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new(()));
    let captured = Arc::new(Unimock::new(
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: 4,
                ..Default::default()
            })),
    ));
    let captured_generation: Arc<dyn RenderGeneration> = captured.clone();
    let changes = Arc::new(Unimock::new((
        captured_head(captured_generation.clone()),
        ChangesServiceMock::classify
            .next_call(matching!(_, _, _, _))
            .answers_arc(Arc::new(move |_, _, _, head, _| {
                assert!(Arc::ptr_eq(&head, &captured_generation));
                Err(mokly_compare::error::Error::UnsupportedManager)
            })),
    )));
    let (graphs, _guards) = graph_for(source);
    let service: &dyn BuildService = &CatalogueBuild {
        changes,
        inputs: None,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        config: loader,
        catalogue: builder,
        graphs,
    };
    let mut build_options = options();
    build_options.no_changes = false;
    assert!(service.prepare(Path::new("/repo"), &build_options).is_err());
}

#[test]
fn prepare_keeps_source_rendering_when_head_capture_falls_back() {
    let warning = Warning {
        code: "html-unused-props",
        subject: WarningSubject::Entry("home".into()),
        message: "unused".into(),
    };
    let loader = Arc::new(Unimock::new(
        ConfigLoaderMock::load
            .next_call(matching!(_, _))
            .returns(Ok(config())),
    ));
    let builder = Arc::new(Unimock::new(
        CatalogueBuilderMock::prepare
            .next_call(matching!(_, _))
            .returns(Ok(prepared(vec![warning.clone()]))),
    ));
    let source = Arc::new(Unimock::new((
        RenderGenerationMock::comparison_capture
            .each_call(matching!())
            .returns(None),
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Ok(RenderSummary {
                documents: 4,
                warnings: vec![warning.clone()],
                ..Default::default()
            })),
    )));
    let (graphs, _guards) = graph_for(source.clone());
    let service: &dyn BuildService = &CatalogueBuild {
        changes: Arc::new(Unimock::new(captured_head(
            source.clone() as Arc<dyn RenderGeneration>
        ))),
        inputs: None,
        cancellation: Arc::new(BuildCancellation::new(Arc::new(Unimock::new(())))),
        config: loader,
        catalogue: builder,
        graphs,
    };
    let prepared = service.prepare(Path::new("/repo"), &options()).unwrap();
    assert!(prepared.generation.comparison_capture().is_none());
    assert_eq!(prepared.summary.documents, 4);
    assert_eq!(prepared.summary.warnings, [warning]);
}
