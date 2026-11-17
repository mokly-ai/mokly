//! Uncaptured usage keeps the source read, absence, and typed error.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use super::support::captured;

#[test]
fn uncaptured_usage_reads_its_source_and_preserves_absence_and_errors() {
    let source = Arc::new(Unimock::new((
        RenderGenerationMock::comparison_usage
            .some_call(matching!("uncaptured/index.html"))
            .returns(Ok(Some(CatalogueUsage::Unavailable))),
        RenderGenerationMock::comparison_usage
            .some_call(matching!("absent/index.html"))
            .returns(Ok(None)),
        RenderGenerationMock::comparison_usage
            .some_call(matching!("failed/index.html"))
            .returns(Err(GraphError::InputsChanged {
                path: PathBuf::from("changed.html"),
            })),
    )));
    let restores = Arc::new(AtomicUsize::new(0));
    let generation = captured(
        source,
        vec![("kept-absent/index.html", None)],
        restores.clone(),
    );
    assert_eq!(
        generation
            .comparison_usage("uncaptured/index.html")
            .unwrap(),
        Some(CatalogueUsage::Unavailable)
    );
    assert_eq!(
        generation.comparison_usage("absent/index.html").unwrap(),
        None
    );
    assert!(matches!(
        generation.comparison_usage("failed/index.html"),
        Err(GraphError::InputsChanged { path }) if path == Path::new("changed.html")
    ));
    assert_eq!(
        generation
            .comparison_usage("kept-absent/index.html")
            .unwrap(),
        None
    );
    assert_eq!(restores.load(Ordering::SeqCst), 0);
}
