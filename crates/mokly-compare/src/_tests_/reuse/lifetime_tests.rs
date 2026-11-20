//! Admission preserves complete accepted evidence across failed and draining attempts.

use std::sync::Arc;

use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGenerationMock;
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

use crate::comparison_reuse::{ComparisonReuse, MemoryComparisons, ReuseFence};
use crate::error::Error;

use super::support::{Fixture, engine, request};

#[test]
fn failed_or_cancelled_retries_discard_staging_and_keep_the_previous_complete_slot() {
    let store = MemoryComparisons::new(1024 * 1024);
    let original = Fixture::default();
    let before = original.generation(false, true);
    let after = original.generation(true, true);
    let accepted = store.begin(engine(), ReuseFence::new(&"settings"));
    accepted
        .compare_prepared(&request(), before.clone(), after.clone())
        .unwrap();
    accepted.accept();

    for (cancelled, expected) in [
        (false, (Some(std::path::PathBuf::from("changed.ts")), None)),
        (true, (None, Some(RuntimeCode::Cancelled))),
    ] {
        let mut edited = original.clone();
        edited
            .html
            .insert("one".into(), "<p>unpublished edit</p>".into());
        let attempt = store.begin(engine(), ReuseFence::new(&"settings"));
        attempt
            .compare_prepared(&request(), before.clone(), edited.generation(true, true))
            .unwrap();
        assert_eq!((attempt.work().reused, attempt.work().compared), (1, 1));
        let failing = Unimock::new(
            RenderGenerationMock::render_all
                .some_call(matching!())
                .answers_arc(Arc::new(move |_| {
                    Err(if cancelled {
                        GraphError::Runtime {
                            source: RuntimeDiagnostic {
                                code: RuntimeCode::Cancelled,
                                message: "cancelled".into(),
                            },
                        }
                    } else {
                        GraphError::InputsChanged {
                            path: "changed.ts".into(),
                        }
                    })
                })),
        );
        let error = attempt
            .compare_prepared(&request(), before.clone(), Arc::new(failing))
            .unwrap_err();
        let observed = match error {
            Error::Graph {
                source: GraphError::Runtime { source },
            } => (None, Some(source.code)),
            Error::Graph {
                source: GraphError::InputsChanged { path },
            } => (Some(path), None),
            error => panic!("unexpected failure: {error}"),
        };
        assert_eq!(observed, expected);
        attempt.accept();
        let probe = store.begin(engine(), ReuseFence::new(&"settings"));
        probe
            .compare_prepared(&request(), before.clone(), after.clone())
            .unwrap();
        assert_eq!((probe.work().reused, probe.work().compared), (2, 0));
        probe.discard();
    }
}

#[test]
fn successful_overflow_clears_prior_evidence_without_admitting_a_prefix() {
    let bound = 128 * 1024;
    let store = MemoryComparisons::new(bound);
    let original = Fixture::default();
    let before = original.generation(false, true);
    let after = original.generation(true, true);
    let first = store.begin(engine(), ReuseFence::new(&"settings"));
    first
        .compare_prepared(&request(), before.clone(), after.clone())
        .unwrap();
    assert!(!first.work().overflowed);
    first.accept();

    let mut larger = original.clone();
    for index in 0..256 {
        let mut entry = original.entries[0].clone();
        entry.metadata.path = format!("added-{index}");
        larger
            .html
            .insert(entry.metadata.path.clone(), "<p>new</p>".into());
        larger.entries.push(entry);
    }
    let overflowing = store.begin(engine(), ReuseFence::new(&"settings"));
    overflowing
        .compare_prepared(&request(), before.clone(), larger.generation(true, true))
        .unwrap();
    let work = overflowing.work();
    assert!(work.overflowed);
    assert_eq!((work.reused, work.compared), (2, 256));
    assert!(
        work.candidate_views > 0,
        "the candidate must collect a prefix before overflow"
    );
    assert!(
        work.peak_bytes <= bound,
        "accepted, staged, and draining evidence share the bound"
    );
    overflowing.accept();
    let next = store.begin(engine(), ReuseFence::new(&"settings"));
    next.compare_prepared(&request(), before, after).unwrap();
    assert_eq!((next.work().reused, next.work().compared), (0, 2));
    assert_eq!(next.work().accepted_bytes, 0);
}

#[test]
fn adopted_settings_base_and_catalogue_fences_require_a_full_comparison() {
    let store = MemoryComparisons::new(1024 * 1024);
    let fixture = Fixture::default();
    let before = fixture.generation(false, true);
    let after = fixture.generation(true, true);
    let first = store.begin(engine(), ReuseFence::new(&"settings"));
    first
        .compare_prepared(&request(), before.clone(), after.clone())
        .unwrap();
    first.accept();
    for changed in [
        "settings",
        "base-ref",
        "base-commit",
        "catalogue",
        "unknown",
    ] {
        let mut request = request();
        let fence = match changed {
            "settings" => ReuseFence::new(&"different settings"),
            "base-ref" => {
                request.base_ref = "other".into();
                ReuseFence::new(&"settings")
            }
            "base-commit" => {
                request.base_commit = "c".repeat(40);
                ReuseFence::new(&"settings")
            }
            "catalogue" => {
                request.catalogue_identity = "d".repeat(64);
                ReuseFence::new(&"settings")
            }
            _ => None,
        };
        let attempt = store.begin(engine(), fence);
        attempt
            .compare_prepared(&request, before.clone(), after.clone())
            .unwrap();
        assert_eq!(
            (attempt.work().reused, attempt.work().compared),
            (0, 2),
            "{changed}"
        );
        attempt.discard();
    }
}
