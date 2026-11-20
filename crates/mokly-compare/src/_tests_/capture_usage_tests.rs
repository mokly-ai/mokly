//! Untrusted document proofs preserve restoration and exact source fallback errors.

use std::collections::BTreeMap;
use std::io;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_proof::{ComparisonRead, ProofMode, content_identity};
use mokly_graph::document_error::{CodecError, CodecInternalError};
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock, RenderSummary};
use unimock::{MockFn, Unimock, matching};

use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::DocumentRestorerMock;
use crate::comparison_capture::CapturedView;

#[test]
fn untrusted_document_proof_preserves_restore_fallback_and_its_source_failure() {
    let source: Arc<dyn RenderGeneration> = Arc::new(Unimock::new((
        RenderGenerationMock::comparison_identity
            .each_call(matching!(ComparisonRead::Document, _, ProofMode::Retained))
            .returns(Some(content_identity(b"source document"))),
        RenderGenerationMock::comparison_document
            .some_call(matching!("base/index.html"))
            .returns(Err(GraphError::InputsChanged {
                path: "changed.html".into(),
            })),
    )));
    let _ = source.comparison_identity(
        ComparisonRead::Document,
        "base/index.html",
        ProofMode::Retained,
    );
    let artifact = Artifact {
        bytes: b"captured".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: None,
    };
    let generation: &dyn RenderGeneration = &CapturedGeneration {
        source,
        views: BTreeMap::from([(
            "base/index.html".into(),
            CapturedView::encode(&artifact, Closure::default()).unwrap(),
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(Unimock::new(
            DocumentRestorerMock::restore
                .some_call(matching!(_))
                .returns(Err(CodecError::Internal(CodecInternalError::Io {
                    source: io::Error::other("private restore failure"),
                }))),
        )),
    };
    assert_eq!(
        generation.comparison_identity(
            ComparisonRead::Document,
            "base/index.html",
            ProofMode::Retained,
        ),
        None
    );
    assert_eq!(
        generation.comparison_identity(
            ComparisonRead::Document,
            "uncaptured/index.html",
            ProofMode::Retained
        ),
        Some(content_identity(b"source document"))
    );
    let observed = match generation.comparison_document("base/index.html") {
        Err(GraphError::InputsChanged { path }) => Some(path),
        _ => None,
    };
    assert_eq!(observed, Some("changed.html".into()));
}
