//! Reused views still join the current global checks and unnormalized failure warnings.

use std::sync::Arc;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_compare::comparison_reuse::MemoryComparisons;
use mokly_compare::comparison_types::{Comparison, ComparisonResult};
use mokly_compare::error::Error;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_html::composition::{ComposeRequest, Composed, Composer, HtmlComposer};
use mokly_html::error;
use mokly_html::fragment::DeferredFragments;

use super::support::{Fixture, attempt, engine, request};

struct Seeded;
impl Composer for Seeded {
    fn compose(&self, request: &ComposeRequest<'_>) -> error::Result<Composed> {
        let mut document = HtmlComposer {
            fragments: Arc::new(DeferredFragments),
        }
        .compose(request)?;
        if request.entry.metadata.path == "home" {
            document.resources.push("seed.css".into());
        }
        Ok(document)
    }
}

fn generation(fixture: &Fixture) -> Arc<dyn RenderGeneration> {
    fixture.with_composer(Arc::new(WorkingTree), Arc::new(Seeded))
}

#[derive(Debug, Eq, PartialEq)]
struct Failure {
    messages: Vec<(String, String)>,
    warnings: Vec<(String, String, String)>,
}

fn messages(error: &GraphError) -> Vec<(String, String)> {
    match error {
        GraphError::Attempt { failures, .. } => failures.iter().flat_map(messages).collect(),
        GraphError::Document { source, .. } => messages(source),
        GraphError::Invalid { route, message, .. } => vec![(route.clone(), message.clone())],
        _ => vec![("unexpected graph error".into(), error.to_string())],
    }
}

fn failure(result: Result<ComparisonResult, Error>) -> Option<Failure> {
    match result {
        Ok(_) => None,
        Err(Error::Graph { source }) => Some(Failure {
            messages: messages(&source),
            warnings: source
                .warnings()
                .iter()
                .map(|warning| {
                    (
                        warning.code.into(),
                        warning.printed_subject(),
                        warning.message.clone(),
                    )
                })
                .collect(),
        }),
        Err(error) => Some(Failure {
            messages: vec![("unexpected comparison error".into(), error.to_string())],
            warnings: vec![],
        }),
    }
}

#[test]
fn reused_referrer_rechecks_removed_destination_anchors_and_keeps_failure_warning_order() {
    let base = Fixture::new();
    let head = Fixture::new();
    for fixture in [&base, &head] {
        fixture.write("seed.css", "p{color:red}");
        fixture.write("specs/home.screen.html", "---\ntitle: Home\n---\n<a href=\"mock:target#summary\">Target</a><button><span to=\"target\">Target</span></button>");
    }
    let previous = engine().capture_base(generation(&base)).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let first = attempt(&store);
    first
        .compare_prepared(&request(), previous.clone(), generation(&head))
        .unwrap();
    first.accept();
    head.write(
        "specs/target.screen.html",
        "---\ntitle: Target\n---\n<h1>No anchor</h1>",
    );
    let next = attempt(&store);
    let result = failure(next.compare_prepared(&request(), previous.clone(), generation(&head)));
    let expected = Some(Failure {
        messages: vec![("home/index.desktop.html".into(), "home/index.desktop.html: logical fragment \"summary\" is missing from target/index.desktop.html".into())],
        warnings: ["home/index.desktop.html", "home/index.mobile.html"].into_iter().flat_map(|route| [
            ("link-control-ancestor".into(), route.into(), "MockLink child control is inside <button>; one click or key press has two targets".into()),
            ("stylesheet-owner".into(), route.into(), "renderer resource \"seed.css\" is a stylesheet and supplies no CSS evidence. Import the CSS or declare it in stylesheets instead.".into()),
        ]).collect(),
    });
    assert_eq!(result, expected);
    assert_eq!(
        failure(engine().compare_prepared(&request(), previous, generation(&head))),
        expected
    );
    assert_eq!(next.work().validation_reused, 2);
    assert_eq!(
        next.work().compared,
        0,
        "complete head validation fails before pairing or the stream"
    );
}

#[test]
fn namespace_check_includes_closure_files_of_reused_views() {
    let base = Fixture::new();
    let head = Fixture::new();
    let previous = engine().capture_base(base.generation()).unwrap();
    let store = MemoryComparisons::new(32 * 1024 * 1024);
    let first = attempt(&store);
    first
        .compare_prepared(&request(), previous.clone(), head.generation())
        .unwrap();
    first.accept();
    head.write("ICON.svg", "<svg><title>one</title></svg>");
    head.write(
        "specs/target.screen.html",
        "---\ntitle: Target\n---\n<h1 id=\"summary\">Target</h1><img src=\"../../ICON.svg\">",
    );
    let next = attempt(&store);
    let expected = Some(Failure {
        messages: vec![(
            "icon.svg".into(),
            "output route collision: icon.svg conflicts with ICON.svg".into(),
        )],
        warnings: vec![],
    });
    assert_eq!(
        failure(next.compare_prepared(&request(), previous.clone(), head.generation())),
        expected
    );
    assert_eq!(
        failure(engine().compare_prepared(&request(), previous, head.generation())),
        expected
    );
    assert_eq!(next.work().validation_reused, 2);
    assert_eq!(next.work().compared, 0);
}
