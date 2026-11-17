//! Failed retained restores are logged and read once at their ordered position.

use std::collections::BTreeMap;
use std::io;
use std::sync::Arc;

use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_error::{CodecError, CodecInternalError};
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderSummary};
use unimock::{MockFn, Unimock, matching};

use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::DocumentRestorerMock;
use crate::comparison_capture::CapturedView;
use crate::error::Error;

use super::control::Control;
use super::inputs::{artifact, closure, route};
use super::support::{compare, source};
use super::trace_tests::with_errors;

fn failed(source: Arc<dyn RenderGeneration>, index: usize) -> Arc<dyn RenderGeneration> {
    Arc::new(CapturedGeneration {
        source,
        views: BTreeMap::from([(
            route(index),
            CapturedView {
                document: EncodedView::encode(&artifact(index)).unwrap(),
                closure: closure(index),
            },
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(Unimock::new(
            DocumentRestorerMock::restore
                .next_call(matching!(_))
                .returns(Err(CodecError::Internal(CodecInternalError::Io {
                    source: io::Error::other("private restore payload"),
                }))),
        )),
    })
}

#[test]
fn failed_restore_reads_one_source_document_then_head_and_uses_only_the_captured_base_closure() {
    let control = Arc::new(Control {
        restore_source: true,
        ..Default::default()
    });
    let before = failed(source(1, 1, control.clone()), 0);
    let after = source(2, 1, control.clone());
    let result = with_errors(control.clone(), || compare(before, after)).unwrap();
    assert_eq!(result.counts.changes, 0);
    assert_eq!(
        *control.events.lock().unwrap(),
        [
            "complete:0",
            "restore-log",
            "document:1:0",
            "document:2:0",
            "closure:2:0",
            "resource:1:0",
            "resource:2:0"
        ]
    );
}

#[test]
fn an_unconsumed_failed_restore_neither_logs_nor_reads_its_source() {
    for rolling in [false, true] {
        let control = Arc::new(Control {
            rolling,
            entry_counts: rolling.then(|| vec![1, 0, 1, 4]),
            fail_from: Some(0),
            has_deferred: true,
            ..Default::default()
        });
        let before = failed(source(1, if rolling { 6 } else { 2 }, control.clone()), 1);
        let after = source(2, if rolling { 6 } else { 2 }, control.clone());
        let error = with_errors(control.clone(), || compare(before, after)).unwrap_err();
        assert!(
            matches!(error, Error::Graph { source: GraphError::InputsChanged { path } } if path.to_str() == Some("stage-0"))
        );
        let events = control.events.lock().unwrap();
        assert_eq!(
            events
                .iter()
                .filter(|event| !event.starts_with("complete:"))
                .cloned()
                .collect::<Vec<_>>(),
            ["document:1:0"]
        );
        if rolling {
            assert_eq!(*control.admitted.lock().unwrap(), [0, 1, 2, 3]);
            assert_eq!(*control.consumed.lock().unwrap(), [0]);
        }
        assert_eq!(control.live(), 0);
    }
}
