//! Base proofs check reader validity without reading or releasing source inputs.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use mokly_git::control::CancellationMock;
use mokly_graph::comparison_proof::{ComparisonRead, ProofMode, content_identity};
use mokly_graph::error::GraphError;
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use unimock::{MockFn, Unimock, matching};

use crate::base_reader::BaseReader;
use crate::base_retention::{BaseReleaseMock, BaseReuse, KeptBase};

#[test]
fn retained_base_proofs_decline_unknown_cancelled_and_failed_readers_without_source_reads() {
    let cancelled = Arc::new(AtomicBool::new(false));
    let invalid = Arc::new(AtomicBool::new(false));
    let cancel_inside = Arc::new(AtomicBool::new(false));
    let proofs = Arc::new(AtomicUsize::new(0));
    let releases = Arc::new(AtomicUsize::new(0));
    let generation = Arc::new(Unimock::new((
        RenderGenerationMock::check_cancelled
            .each_call(matching!())
            .answers_arc({
                let invalid = invalid.clone();
                Arc::new(move |_| {
                    if invalid.load(Ordering::Acquire) {
                        Err(GraphError::InputsChanged {
                            path: "base".into(),
                        })
                    } else {
                        Ok(())
                    }
                })
            }),
        RenderGenerationMock::comparison_identity
            .each_call(matching!(ComparisonRead::Resource, _, ProofMode::Retained))
            .answers_arc({
                let cancelled = cancelled.clone();
                let cancel_inside = cancel_inside.clone();
                let proofs = proofs.clone();
                Arc::new(move |_, _, route, _| {
                    proofs.fetch_add(1, Ordering::AcqRel);
                    if cancel_inside.load(Ordering::Acquire) {
                        cancelled.store(true, Ordering::Release);
                    }
                    (route == "static/known.css").then(|| content_identity(b"known"))
                })
            }),
        RenderGenerationMock::resource_digest
            .some_call(matching!("static/failed.png"))
            .answers(&|_, _| {
                Err(GraphError::InputsChanged {
                    path: "failed.png".into(),
                })
            }),
    )));
    let reader = BaseReader::new(BaseReuse {
        base: Arc::new(KeptBase {
            generation,
            failures: Arc::new(Unimock::new(())),
            scripts_off: false,
            freshness: None,
        }),
        cancellation: Arc::new(Unimock::new(
            CancellationMock::cancelled
                .each_call(matching!())
                .answers_arc({
                    let cancelled = cancelled.clone();
                    Arc::new(move |_| cancelled.load(Ordering::Acquire))
                }),
        )),
        releaser: Arc::new(Unimock::new(
            BaseReleaseMock::release
                .some_call(matching!(_))
                .answers_arc({
                    let releases = releases.clone();
                    Arc::new(move |_, _| {
                        releases.fetch_add(1, Ordering::AcqRel);
                    })
                }),
        )),
    });
    let proof = |route, mode| reader.comparison_identity(ComparisonRead::Resource, route, mode);
    assert_eq!(
        proof("static/known.css", ProofMode::Retained),
        Some(content_identity(b"known"))
    );
    assert_eq!(proof("static/unknown.css", ProofMode::Retained), None);
    assert_eq!(proof("static/known.css", ProofMode::Current), None);
    cancelled.store(true, Ordering::Release);
    assert_eq!(proof("static/known.css", ProofMode::Retained), None);
    cancelled.store(false, Ordering::Release);
    invalid.store(true, Ordering::Release);
    assert_eq!(proof("static/known.css", ProofMode::Retained), None);
    assert!(!reader.failed());
    assert_eq!(releases.load(Ordering::Acquire), 0);
    invalid.store(false, Ordering::Release);
    cancel_inside.store(true, Ordering::Release);
    assert_eq!(proof("static/known.css", ProofMode::Retained), None);
    assert_eq!(proofs.load(Ordering::Acquire), 3);
    cancelled.store(false, Ordering::Release);
    assert!(
        matches!(reader.resource_digest("static/failed.png"), Err(GraphError::InputsChanged { path }) if path.to_str() == Some("failed.png"))
    );
    assert!(reader.failed());
    assert_eq!(proof("static/known.css", ProofMode::Retained), None);
    assert_eq!(proofs.load(Ordering::Acquire), 3);
    assert_eq!(releases.load(Ordering::Acquire), 1);
}
