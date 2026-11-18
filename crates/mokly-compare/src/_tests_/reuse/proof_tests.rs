//! Shared proof reads preserve current usage without retaining the attempt table.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_graph::comparison_proof::{ComparisonRead, DocumentProof, ProofMode, content_identity};
use mokly_graph::types::{RenderGeneration, RenderGenerationMock};
use mokly_model::review_affected::ReviewSide;
use mokly_model::usage::CatalogueUsage;
use unimock::{MockFn, Unimock, matching};

use crate::reuse_budget::Resident;
use crate::reuse_probes::Probes;
use crate::reuse_reads::Recorder;

#[test]
fn checked_document_usage_survives_compact_read_recording() {
    let before: &dyn RenderGeneration = &Unimock::new(
        RenderGenerationMock::comparison_identity
            .each_call(matching!(_, _, _))
            .returns(Some(content_identity(b"document"))),
    );
    let after: &dyn RenderGeneration = &Unimock::new((
        RenderGenerationMock::comparison_identity
            .each_call(matching!(_, _, _))
            .returns(Some(content_identity(b"document"))),
        RenderGenerationMock::comparison_document_proof
            .some_call(matching!("one/index.html"))
            .answers(&|_, _| {
                Some(DocumentProof {
                    identity: content_identity(b"document"),
                    usage: Some(usage()),
                })
            }),
    ));
    let resident = Resident::new(1024 * 1024);
    let first = Probes::new(&resident);
    let recorder = Recorder::new(&first).unwrap();
    let duplicate = Recorder::new(&first).unwrap();
    for recording in [&recorder, &duplicate] {
        for (side, source) in [(ReviewSide::Before, before), (ReviewSide::After, after)] {
            for kind in [ComparisonRead::Document, ComparisonRead::Closure] {
                recording.record(source, side, kind, "one/index.html");
            }
        }
    }
    assert_eq!(first.recording_reads.load(Ordering::Relaxed), 4);
    assert_eq!((recorder.len(), duplicate.len()), (4, 4));
    let second = Probes::new(&resident);
    recorder.seed(&second);
    assert_eq!(
        recorder.valid(before, after, &second, Some("one/index.html")),
        Some(Some(usage()))
    );
    let weak = Arc::downgrade(&first);
    recorder.seal();
    duplicate.seal();
    {
        let _released = first;
    }
    assert!(
        weak.upgrade().is_none(),
        "saved read sets must release their attempt table"
    );
}

fn usage() -> CatalogueUsage {
    CatalogueUsage::Ready {
        instances: vec![],
        slots: vec![],
        ranges: vec![],
    }
}

#[test]
fn an_unknown_base_probe_retries_after_a_full_read_learns_absence() {
    let known = Arc::new(AtomicBool::new(true));
    let proof = known.clone();
    let learned = known.clone();
    let before: &dyn RenderGeneration = &Unimock::new((
        RenderGenerationMock::comparison_identity
            .each_call(matching!(
                ComparisonRead::Resource,
                "static/head-only.css",
                ProofMode::Retained
            ))
            .answers_arc(Arc::new(move |_, _, _, _| {
                proof
                    .load(Ordering::Acquire)
                    .then(|| content_identity(b"absent"))
            })),
        RenderGenerationMock::resource_bytes
            .some_call(matching!("static/head-only.css"))
            .answers_arc(Arc::new(move |_, _| {
                learned.store(true, Ordering::Release);
                Ok(None)
            })),
    ));
    let after: &dyn RenderGeneration = &Unimock::new(());
    let resident = Resident::new(65536);
    let first = Probes::new(&resident);
    let recorder = Recorder::new(&first).unwrap();
    recorder.record(
        before,
        ReviewSide::Before,
        ComparisonRead::Resource,
        "static/head-only.css",
    );
    recorder.seal();
    let current = Probes::new(&resident);
    known.store(false, Ordering::Release);
    assert_eq!(recorder.valid(before, after, &current, None), None);
    assert_eq!(before.resource_bytes("static/head-only.css").unwrap(), None);
    assert_eq!(recorder.valid(before, after, &current, None), Some(None));
    assert_eq!(current.reads.load(Ordering::Relaxed), 2);
}
