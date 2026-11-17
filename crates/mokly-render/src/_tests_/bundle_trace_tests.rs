//! Actual request spans report all cache outcomes, while direct serves only notify.

use std::collections::BTreeMap;
use std::sync::Arc;

use mokly_sidecar::bundle_outcomes::CacheOutcome;
use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence};
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::{request, served};
use crate::leases::BundleLease;
use crate::runtime::Runtime;

#[path = "bundle_trace_capture.rs"]
mod bundle_trace_capture;
use bundle_trace_capture::Capture;

fn params() -> Bundle {
    Bundle {
        evaluation: None,
        entry_files: vec![],
        renderer: None,
        stories_files: vec![],
        source_root: "/repo".into(),
        configuration_directory: ".".into(),
        repository_roots: vec![],
        module_resolution: Default::default(),
    }
}

fn result(cache: CacheOutcome) -> MethodResult {
    MethodResult::Bundle(Box::new(results::Bundle {
        generation: "generation".into(),
        epoch: 7,
        cache: Some(cache),
        modules: vec![],
        unmapped_dependency_directories: None,
        compiled: CompiledGeneration {
            toolchain: "fixture".into(),
            reuse_evidence: ReuseEvidence {
                complete: true,
                inputs: Default::default(),
            },
            identity: "identity".into(),
            code: String::new(),
            runtime_key: "runtime".into(),
            unmapped_dependency_directories: None,
            dependency_roots: vec![],
            css_modules: vec![],
            sources: Default::default(),
            peers: Default::default(),
            inputs: Default::default(),
            metadata_inputs: Default::default(),
            input_directories: Default::default(),
            metadata_directories: Default::default(),
        },
    }))
}

fn runtime(pool: Unimock) -> Runtime {
    Runtime::new(
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(pool),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        "test".into(),
        None,
    )
}

#[test]
fn actual_bundle_requests_record_the_cache_outcome_and_success_status() {
    let capture = Capture::default();
    for (cache, expected) in [
        (CacheOutcome::Hit, "hit"),
        (CacheOutcome::Memory, "memory"),
        (CacheOutcome::NoRecord, "no-record"),
        (CacheOutcome::StampMismatch, "stamp-mismatch"),
        (CacheOutcome::VersionMismatch, "version-mismatch"),
        (CacheOutcome::Damaged, "damaged"),
        (CacheOutcome::Unavailable, "unavailable"),
    ] {
        let runtime = runtime(Unimock::new((
            PoolMock::request
                .some_call(matching!(_))
                .returns(Ok(result(cache))),
            PoolMock::release_generation
                .some_call(matching!("generation", 7))
                .returns(()),
        )));
        tracing::subscriber::with_default(capture.clone(), || {
            let (result, lease) = request(&runtime, &params()).unwrap();
            assert_eq!(result.generation, "generation");
            assert_eq!(lease.epoch, 7);
        });
        assert_eq!(
            capture.fields().last().unwrap(),
            &BTreeMap::from([
                ("cache".into(), expected.into()),
                ("status".into(), "ok".into()),
            ])
        );
    }
    assert_eq!(capture.fields().len(), 7);
}

#[test]
fn direct_serves_notify_the_pool_without_creating_a_bundle_request_span() {
    let capture = Capture::default();
    let runtime = runtime(Unimock::new((
        PoolMock::served_generation
            .some_call(matching!("generation", 7))
            .returns(()),
        PoolMock::release_generation
            .some_call(matching!("generation", 7))
            .returns(()),
    )));
    let lease = BundleLease {
        id: "generation".into(),
        epoch: 7,
        pool: runtime.pool.clone(),
    };
    tracing::subscriber::with_default(capture.clone(), || served(&runtime, &lease));
    assert_eq!(capture.fields().len(), 0);
}
