//! A failed retained view uses its own side's source through the public read path.

use std::collections::BTreeMap;
use std::io;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::document_codec::EncodedView;
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
            CapturedView {
                document: EncodedView::encode(&source).unwrap(),
                closure: Closure::default(),
            },
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
