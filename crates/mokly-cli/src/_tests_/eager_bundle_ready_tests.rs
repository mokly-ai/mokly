//! Only a completed head bundle opens the cold source milestone.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use mokly_server::changes::ChangeToken;
use mokly_sidecar::methods::{Bundle, BundleRequest, Call};
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_eager_source_gate::{SourceAttempt, SourceStartsMock};
use crate::serve_pool::serve_pool_support::{capacity, css};

use super::{PoolScheduling, ServePool};

fn bundle() -> Call {
    Call::Bundle(BundleRequest {
        plan: None,
        capture: None,
        params: Bundle {
            source_root: "/repo".into(),
            configuration_directory: ".".into(),
            entry_files: Vec::new(),
            stories_files: Vec::new(),
            renderer: None,
            repository_roots: Vec::new(),
            module_resolution: Default::default(),
            evaluation: None,
        },
    })
}

#[test]
fn eager_source_release_observes_only_completed_head_bundle_calls() {
    let completions = Arc::new(AtomicUsize::new(0));
    let recorded = completions.clone();
    let starts = Arc::new(
        Unimock::new((
            SourceStartsMock::current
                .each_call(matching!())
                .returns(SourceAttempt(1)),
            SourceStartsMock::bundle_finished
                .each_call(matching!(SourceAttempt(1)))
                .answers_arc(Arc::new(move |_, _| {
                    recorded.fetch_add(1, Ordering::SeqCst);
                })),
        ))
        .no_verify_in_drop(),
    );
    let in_flight = completions.clone();
    let pool = ServePool::new(
        Arc::new(Unimock::new(
            PoolMock::request
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, _| {
                    assert_eq!(in_flight.load(Ordering::SeqCst), 0);
                    Ok(MethodResult::Empty)
                })),
        )),
        capacity(4),
    )
    .with_source_starts(starts);
    let mut observed = Vec::new();
    pool.pool(Some(Arc::new(ChangeToken::default())))
        .request(bundle())
        .unwrap();
    observed.push(completions.load(Ordering::SeqCst));
    pool.pool(None).request(css("/repo", 0)).unwrap();
    observed.push(completions.load(Ordering::SeqCst));
    pool.pool(None).request(bundle()).unwrap();
    observed.push(completions.load(Ordering::SeqCst));
    assert_eq!(observed, [0, 0, 1]);
}
