//! Actual request spans report all cache outcomes, while direct serves only notify.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use mokly_sidecar::bundle_outcomes::CacheOutcome;
use mokly_sidecar::compiled::{CompiledGeneration, ReuseEvidence};
use mokly_sidecar::methods::{Bundle, BundleCapture};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::bundle_attempt::{request, served};
use crate::leases::BundleLease;
use crate::runtime::Runtime;

fn params() -> Bundle {
    Bundle {
        vite: false,
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
        plan: None,
        generation: "generation".into(),
        epoch: 7,
        cache: Some(cache),
        compile_count: u64::from(!matches!(cache, CacheOutcome::Memory | CacheOutcome::Hit)),
        modules: vec![],
        unmapped_dependency_directories: None,
        compiled: Arc::new(CompiledGeneration {
            toolchain: "fixture".into(),
            metadata_identity: None,
            reuse_evidence: Arc::new(ReuseEvidence {
                uncaptured: None,
                durable: true,
                complete: true,
                inputs: Default::default(),
            }),
            identity: "identity".into(),
            code: String::new(),
            vite: None,
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
        }),
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
    let capture = Trace::default();
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
        capture.in_scope(|| {
            let (result, lease) = request(&runtime, &params()).unwrap();
            assert_eq!(result.generation, "generation");
            assert_eq!(lease.epoch, 7);
        });
        let spans = capture.spans();
        for span in &spans {
            assert_eq!(span.name, "catalogue.bundle");
        }
        assert_eq!(
            &spans.last().unwrap().fields,
            &BTreeMap::from([
                ("cache".into(), expected.into()),
                ("status".into(), "ok".into()),
            ])
        );
    }
    assert_eq!(capture.spans().len(), 7);
}

#[test]
fn direct_serves_notify_only_for_full_capture_without_creating_bundle_request_spans() {
    let capture = Trace::default();
    let notices = Arc::new(Mutex::new(Vec::new()));
    let recorded = notices.clone();
    let mut runtime = runtime(Unimock::new((
        PoolMock::served_generation
            .some_call(matching!("generation", 7))
            .answers_arc(Arc::new(move |_, generation, epoch| {
                recorded
                    .lock()
                    .unwrap()
                    .push((generation.to_owned(), epoch));
            })),
        PoolMock::release_generation
            .some_call(matching!("generation", 7))
            .returns(()),
    )));
    let lease = BundleLease {
        id: "generation".into(),
        epoch: 7,
        pool: runtime.pool.clone(),
    };
    capture.in_scope(|| {
        runtime.bundle_capture = BundleCapture::ServeEdit;
        served(&runtime, &lease);
        assert_eq!(*notices.lock().unwrap(), Vec::<(String, u64)>::new());
        runtime.bundle_capture = BundleCapture::Full;
        served(&runtime, &lease);
        assert_eq!(*notices.lock().unwrap(), [("generation".to_owned(), 7)]);
    });
    assert_eq!(capture.spans().len(), 0);
}
