//! Default usage reads preserve document metadata and source failures.

use std::sync::Arc;

use mokly_html::composition::Composed;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::cache::Artifact;
use crate::error::GraphError;
use crate::types::{RenderGeneration, RenderGenerationMock};

#[test]
fn comparison_usage_preserves_document_metadata_absence_and_source_errors() {
    let artifact = |document| {
        Arc::new(Artifact {
            bytes: b"document".to_vec(),
            content_type: "text/html".into(),
            fragment: None,
            document,
        })
    };
    let generation: &dyn RenderGeneration = &Unimock::new((
        RenderGenerationMock::comparison_document
            .some_call(matching!("ready/index.html"))
            .returns(Ok(artifact(Some(Composed {
                tree: vec![],
                usage: CatalogueUsage::Ready {
                    instances: vec![],
                    slots: vec![],
                    ranges: vec![],
                },
                warnings: vec![],
                resources: vec![],
                components: vec![],
                links: vec![],
            })))),
        RenderGenerationMock::comparison_document
            .some_call(matching!("absent/index.html"))
            .returns(Ok(artifact(None))),
        RenderGenerationMock::comparison_document
            .some_call(matching!("failed/index.html"))
            .returns(Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: "source cancelled".into(),
                },
            })),
    ));
    assert_eq!(
        generation.comparison_usage("ready/index.html").unwrap(),
        Some(CatalogueUsage::Ready {
            instances: vec![],
            slots: vec![],
            ranges: vec![],
        })
    );
    assert_eq!(
        generation.comparison_usage("absent/index.html").unwrap(),
        None
    );
    let GraphError::Runtime { source } = generation
        .comparison_usage("failed/index.html")
        .unwrap_err()
    else {
        panic!("expected the source cancellation error")
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(source.message, "source cancelled");
}
