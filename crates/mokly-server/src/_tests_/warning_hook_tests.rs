//! Saved, background, and transient renders retain their captured warning hook. A
//! background render returns its warnings for the usage pass to report in order.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_graph::cache::Artifact;
use mokly_graph::error::GraphError;
use mokly_graph::key::NodeKey;
use mokly_graph::types::{DocumentPlan, RenderGenerationMock, TemporaryDocument};
use mokly_html::composition::Composed;
use mokly_model::axes::ColorScheme;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::backend::{Documents, GraphDocuments};
use crate::error::ServerError;
use crate::public_read::PublicReaderMock;
use crate::warnings::RenderWarningsMock;

const ROUTE: &str = "home/index.html";

fn warning() -> Warning {
    Warning {
        code: "marker-in-raw-text",
        subject: WarningSubject::Route(ROUTE.into()),
        message: "a marker in raw text is ignored".into(),
    }
}

fn plans() -> BTreeMap<String, DocumentPlan> {
    BTreeMap::from([(
        ROUTE.into(),
        DocumentPlan {
            resource_key: "resource".into(),
            route: ROUTE.into(),
            key: NodeKey("document".into()),
            entry: 0,
            viewport: None,
            color_scheme: ColorScheme::Light,
            stylesheets: vec![],
        },
    )])
}

fn artifact() -> Arc<Artifact> {
    Arc::new(Artifact {
        bytes: b"<h1>Home</h1>".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: Some(Composed {
            tree: vec![],
            usage: CatalogueUsage::Unavailable,
            warnings: vec![warning()],
            resources: vec![],
            components: vec![],
            links: vec![],
        }),
    })
}

#[test]
fn build_warning_hook_delivers_cached_demand_and_background_records_without_changing_bytes() {
    for background in [false, true] {
        let count = if background { 1 } else { 2 };
        let generation = Unimock::new((
            RenderGenerationMock::plans
                .each_call(matching!())
                .returns(plans()),
            RenderGenerationMock::render
                .each_call(matching!("home/index.html"))
                .answers(&|_, _| Ok(artifact()))
                .n_times(count),
        ));
        let sink = Unimock::new(
            RenderWarningsMock::report
                .each_call(matching!((warnings, failed) if *warnings == [warning()] && !failed))
                .returns(())
                .n_times(count),
        );
        let documents = GraphDocuments::new(
            Arc::new(generation),
            Arc::new(Unimock::new(())),
            Arc::new(sink),
            Arc::new(Unimock::new(())),
        );
        if background {
            assert_eq!(documents.background(ROUTE).unwrap(), [warning()]);
            assert!(documents.background(ROUTE).unwrap().is_empty());
            documents.report(&[warning()], false);
        } else {
            for _ in 0..2 {
                let file = documents.generated(ROUTE).unwrap().unwrap();
                assert_eq!(file.bytes.as_ref(), b"<h1>Home</h1>");
            }
        }
        assert_eq!(documents.usage(ROUTE), Some(CatalogueUsage::Unavailable));
    }
}

#[test]
fn build_warning_hook_delivers_retained_records_of_each_render_failure() {
    for background in [false, true] {
        let mock = Unimock::new((
            RenderGenerationMock::plans
                .next_call(matching!())
                .returns(plans()),
            RenderGenerationMock::render
                .next_call(matching!("home/index.html"))
                .returns(Err(GraphError::Attempt {
                    failures: vec![],
                    warnings: vec![warning()],
                })),
            RenderWarningsMock::report
                .next_call(matching!((warnings, failed) if *warnings == [warning()] && *failed))
                .returns(()),
        ));
        let documents = GraphDocuments::new(
            Arc::new(mock.clone()),
            Arc::new(Unimock::new(())),
            Arc::new(mock),
            Arc::new(Unimock::new(())),
        );
        if background {
            let Err(ServerError::Render { source }) = documents.background(ROUTE) else {
                panic!("the background render keeps its failure");
            };
            assert_eq!(source.warnings(), [warning()]);
            documents.report(&source.warnings(), true);
        } else {
            assert!(documents.generated(ROUTE).is_err());
        }
    }
}

#[test]
fn build_warning_transient_hook_keeps_warnings_out_of_preview_files_and_errors() {
    for fails in [false, true] {
        let result = if fails {
            Err(GraphError::Attempt {
                failures: vec![],
                warnings: vec![warning()],
            })
        } else {
            Ok(TemporaryDocument {
                artifact: artifact(),
                closure: Default::default(),
            })
        };
        let mock = Unimock::new((
            RenderGenerationMock::plans
                .next_call(matching!())
                .returns(plans()),
            RenderGenerationMock::render_props
                .next_call(matching!("home/index.html", _))
                .returns(result),
            RenderWarningsMock::report
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, warnings, failed| {
                    assert_eq!(warnings, [warning()]);
                    assert_eq!(failed, fails);
                })),
        ));
        let documents = GraphDocuments::new(
            Arc::new(mock.clone()),
            Arc::new(Unimock::new(())),
            Arc::new(mock),
            Arc::new(Unimock::new(())),
        );
        let result = documents.preview(ROUTE, &Default::default());
        if fails {
            assert!(result.is_err());
        } else {
            let preview = result.unwrap();
            assert_eq!(preview.files.len(), 1);
            assert_eq!(
                preview.files[&preview.document].bytes.as_ref(),
                b"<h1>Home</h1>"
            );
        }
    }
}

#[test]
fn build_warning_preview_resource_failure_keeps_the_rendered_records() {
    let mut rendered = TemporaryDocument {
        artifact: artifact(),
        closure: Default::default(),
    };
    rendered.closure.files.insert("missing.svg".into());
    let mock = Unimock::new((
        RenderGenerationMock::plans
            .next_call(matching!())
            .returns(plans()),
        RenderGenerationMock::render_props
            .next_call(matching!("home/index.html", _))
            .returns(Ok(rendered)),
        PublicReaderMock::read
            .next_call(matching!("missing.svg", _))
            .returns(Ok(None)),
        RenderWarningsMock::report
            .next_call(matching!((warnings, failed) if *warnings == [warning()] && *failed))
            .returns(()),
    ));
    let documents = GraphDocuments::new(
        Arc::new(mock.clone()),
        Arc::new(mock.clone()),
        Arc::new(mock),
        Arc::new(Unimock::new(())),
    );
    assert!(documents.preview(ROUTE, &Default::default()).is_err());
}
