//! A validated uncaptured base must not trigger another collection.

use std::sync::Arc;

use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use unimock::{MockFn, Unimock, matching};

use crate::comparison::Engine;
use crate::comparison_types::{Comparison, ComparisonRequest};
use crate::error::Error;

#[test]
fn prepared_source_fallback_starts_head_validation_without_reading_the_base_again() {
    let engine = Engine {
        moves: Arc::new(Unimock::new(())),
        css: Arc::new(MemoryParsedCss::new(1024)),
    };
    let request = ComparisonRequest {
        base_ref: "base".into(),
        base_commit: "a".repeat(40),
        catalogue_identity: "b".repeat(64),
    };
    let before = Arc::new(Unimock::new(()));
    let after = Arc::new(Unimock::new(
        RenderGenerationMock::render_all
            .next_call(matching!())
            .returns(Err(GraphError::InputsChanged {
                path: "head-validation".into(),
            })),
    ));
    let error = engine
        .compare_prepared(&request, before, after)
        .unwrap_err();
    assert!(
        matches!(error, Error::Graph { source: GraphError::InputsChanged { path } } if path.to_str() == Some("head-validation"))
    );
}
