//! Kept readers preserve parallel retained inputs and checked source fallbacks.

use std::collections::BTreeMap;
use std::io;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mokly_git::control::CancellationMock;
use mokly_graph::comparison_input::RetainedComparisonInput;
use mokly_graph::document_codec::EncodedView;
use mokly_graph::document_error::{CodecError, CodecInternalError};
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock, RenderSummary};
use mokly_model::runtime_diagnostic::RuntimeCode;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::base_reader::BaseReader;
use crate::base_retention::{BaseReleaseMock, BaseReuse, KeptBase};
use crate::capture_generation::CapturedGeneration;
use crate::capture_restore::DocumentRestorerMock;
use crate::comparison_capture::CapturedView;
use crate::error::Error;

use super::control::Control;
use super::inputs::{artifact, closure, route};
use super::support::{captured, compare, source};

fn reader(
    generation: Arc<dyn RenderGeneration>,
    cancelled: Arc<AtomicBool>,
    releases: Option<Arc<AtomicUsize>>,
) -> BaseReader {
    BaseReader::new(BaseReuse {
        base: Arc::new(KeptBase {
            generation,
            failures: Arc::new(Unimock::new(())),
            scripts_off: true,
            freshness: None,
        }),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| cancelled.load(Ordering::Acquire))),
        )),
        releaser: Arc::new(if let Some(releases) = releases {
            Unimock::new(
                BaseReleaseMock::release
                    .each_call(matching!(_))
                    .answers_arc(Arc::new(move |_, _| {
                        releases.fetch_add(1, Ordering::AcqRel);
                    })),
            )
        } else {
            Unimock::new(())
        }),
    })
}

#[test]
fn reused_captured_views_prepare_the_head_in_the_parallel_phase() {
    let control = Arc::new(Control::default());
    let before = Arc::new(reader(
        captured(source(1, 2, control.clone()), &[0, 1]),
        Arc::new(AtomicBool::new(false)),
        None,
    ));
    let result = compare(before, source(2, 2, control.clone())).unwrap();
    assert_eq!(result.counts.changes, 0);
    assert_eq!(result.entries[0].documents.len(), 2);
    assert_eq!(control.stream_calls.load(Ordering::Acquire), 1);
    let events = control.events.lock().unwrap();
    for index in 0..2 {
        let document = events
            .iter()
            .position(|event| event == &format!("document:2:{index}"))
            .unwrap();
        let completed = events
            .iter()
            .position(|event| event == &format!("complete:{index}"))
            .unwrap();
        assert!(
            document < completed,
            "view {index} must read its head before its parallel preparation completes: {events:?}"
        );
    }
    assert_eq!(control.live(), 0);
}

fn capture(source: Arc<dyn RenderGeneration>, restorer: Unimock) -> Arc<dyn RenderGeneration> {
    Arc::new(CapturedGeneration {
        source,
        views: BTreeMap::from([(
            route(0),
            CapturedView {
                document: EncodedView::encode(&artifact(0)).unwrap(),
                closure: closure(0),
            },
        )]),
        summary: RenderSummary::default(),
        styles: BTreeMap::new(),
        retained_bytes: 0,
        encoded_bytes: 0,
        restorer: Box::new(restorer),
    })
}

#[test]
fn failed_retained_restore_reads_through_the_reader_and_records_its_owned_failure() {
    let control = Arc::new(Control {
        restore_source: true,
        fail_from: Some(0),
        ..Default::default()
    });
    let generation = capture(
        source(1, 1, control.clone()),
        Unimock::new(
            DocumentRestorerMock::restore
                .each_call(matching!(_))
                .answers(&|_, _| {
                    Err(CodecError::Internal(CodecInternalError::Io {
                        source: io::Error::other("failed retained restore"),
                    }))
                }),
        ),
    );
    let releases = Arc::new(AtomicUsize::new(0));
    let before = Arc::new(reader(
        generation,
        Arc::new(AtomicBool::new(false)),
        Some(releases.clone()),
    ));
    let error = compare(before.clone(), source(2, 1, control.clone())).unwrap_err();
    assert!(matches!(
        error,
        Error::Graph { source: GraphError::InputsChanged { path } }
            if path.to_str() == Some("stage-0")
    ));
    assert!(
        before.failed(),
        "ordered source failure must belong to the reader"
    );
    assert_eq!(releases.load(Ordering::Acquire), 1);
    assert!(before.retained_comparison_input(&route(0)).is_none());
    assert_eq!(
        *control.events.lock().unwrap(),
        ["complete:0", "document:1:0"]
    );
}

#[test]
fn cancelled_reader_does_not_restore_or_forward_a_retained_input() {
    let restores = Arc::new(AtomicUsize::new(0));
    let generation = capture(
        Arc::new(Unimock::new(
            RenderGenerationMock::check_cancelled
                .each_call(matching!())
                .answers(&|_| Ok(())),
        )),
        Unimock::new(
            DocumentRestorerMock::restore
                .each_call(matching!(_))
                .answers_arc({
                    let restores = restores.clone();
                    Arc::new(move |_, view| {
                        restores.fetch_add(1, Ordering::AcqRel);
                        view.restore()
                    })
                }),
        ),
    );
    let cancelled = Arc::new(AtomicBool::new(false));
    let before = reader(generation, cancelled.clone(), None);
    assert!(matches!(
        before.retained_comparison_input(&route(0)),
        Some(RetainedComparisonInput::Ready(_))
    ));
    assert_eq!(
        before.comparison_usage(&route(0)).unwrap(),
        Some(CatalogueUsage::Ready {
            instances: vec![],
            slots: vec![],
            ranges: vec![],
        })
    );
    cancelled.store(true, Ordering::Release);
    assert!(before.retained_comparison_input(&route(0)).is_none());
    assert_eq!(restores.load(Ordering::Acquire), 1);
    assert!(matches!(
        before.comparison_document(&route(0)),
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
    ));
    assert!(matches!(
        before.comparison_usage(&route(0)),
        Err(GraphError::Runtime { source }) if source.code == RuntimeCode::Cancelled
    ));
    assert!(!before.failed());
}
