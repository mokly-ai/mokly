//! A failed retained view uses its own side's source through the public read path.

use std::collections::{BTreeMap, BTreeSet};
use std::io;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::comparison_input::RetainedComparisonInput;
use mokly_graph::document_error::{CodecError, CodecInternalError};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock, RenderSummary};
use unimock::{MockFn, Unimock, matching};

use crate::capture_restore::DocumentRestorerMock;

use super::{CapturedGeneration, CapturedView};

#[test]
fn a_failed_capture_restore_reads_its_side_source_instead_of_returning_an_error() {
    let source = Arc::new(Artifact {
        bytes: b"base source bytes".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: None,
    });
    let generation: &dyn RenderGeneration = &CapturedGeneration {
        source: Arc::new(Unimock::new(
            RenderGenerationMock::comparison_document
                .some_call(matching!("base/index.html"))
                .returns(Ok(source.clone())),
        )),
        views: BTreeMap::from([(
            "base/index.html".into(),
            CapturedView::encode(&source, Closure::default()).unwrap(),
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(Unimock::new(
            DocumentRestorerMock::restore
                .some_call(matching!(_))
                .returns(Err(CodecError::Internal(CodecInternalError::Io {
                    source: io::Error::other("private document data must not be logged"),
                }))),
        )),
    };
    let restored = generation.comparison_document("base/index.html");
    assert!(
        restored.is_ok(),
        "a failed capture restore must fall back to its source"
    );
    let restored = restored.unwrap();
    assert_eq!(restored.bytes, b"base source bytes");
    assert!(Arc::ptr_eq(&restored, &source));
}

#[test]
fn retained_restore_failure_defers_one_source_document_and_keeps_the_captured_closure() {
    let source = Arc::new(Artifact {
        bytes: b"source document".to_vec(),
        content_type: "text/html".into(),
        fragment: None,
        document: None,
    });
    let generation: &dyn RenderGeneration = &CapturedGeneration {
        source: Arc::new(Unimock::new(
            RenderGenerationMock::comparison_document
                .next_call(matching!("base/index.html"))
                .returns(Ok(source.clone())),
        )),
        views: BTreeMap::from([(
            "base/index.html".into(),
            CapturedView::encode(
                &source,
                Closure {
                    files: ["captured.svg".into()].into(),
                    ..Default::default()
                },
            )
            .unwrap(),
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(Unimock::new(
            DocumentRestorerMock::restore
                .next_call(matching!(_))
                .returns(Err(CodecError::Internal(CodecInternalError::Io {
                    source: io::Error::other("private restore error"),
                }))),
        )),
    };
    let retained = generation.retained_comparison_input("base/index.html");
    assert!(
        retained.is_some(),
        "a failed retained restore must return a deferred recipe"
    );
    let Some(RetainedComparisonInput::Deferred(recipe)) = retained else {
        panic!("expected deferred restore")
    };
    assert_eq!(
        recipe.document("base/index.html").unwrap().bytes,
        source.bytes
    );
    assert_eq!(
        recipe.closure().files,
        BTreeSet::from(["captured.svg".into()])
    );
}
