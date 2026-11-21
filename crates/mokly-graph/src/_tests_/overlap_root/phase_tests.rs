//! Root acquisition precedes admission and existing-worker composition consumes it once.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_html::composition::ComposerMock;
use mokly_html::fragment::{Fragment, FragmentRendererMock};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::background::CompletionMock;
use crate::cache::{MemoryCache, RenderCache};
use crate::error::{GraphError, InternalError};
use crate::workers::RenderWorkersMock;

use super::support::{background, catalogue, document, route, session};

#[test]
fn prepared_root_runs_once_before_worker_and_completes_inside_its_single_consumption() {
    let phase = Arc::new(AtomicUsize::new(0));
    let calls = Arc::new(AtomicUsize::new(0));
    let order = Arc::new(Mutex::new(Vec::new()));
    let provider = Unimock::new(
        FragmentRendererMock::render
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let phase = phase.clone();
                let calls = calls.clone();
                let order = order.clone();
                move |_, _| {
                    assert_eq!(
                        tracing::Span::current().metadata().map(|span| span.name()),
                        Some("render.document")
                    );
                    assert_eq!(phase.load(Ordering::SeqCst), 0);
                    calls.fetch_add(1, Ordering::SeqCst);
                    order.lock().unwrap().push("root");
                    Ok(Fragment {
                        html: document("<p>Prepared</p>"),
                        ..Default::default()
                    })
                }
            })),
    );
    let cache = Arc::new(MemoryCache::new(1 << 20, 0));
    let (mut session, _) = session(catalogue(), Arc::new(provider.clone()), cache.clone());
    let actual = session.state.composer.clone();
    let custom = Unimock::new((
        ComposerMock::can_prepare_root
            .some_call(matching!(_, _))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                move |_, catalogue, entry| actual.can_prepare_root(catalogue, entry)
            })),
        ComposerMock::prepare_root
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                move |_, request| actual.prepare_root(request)
            })),
        ComposerMock::compose_prepared
            .some_call(matching!(_, _))
            .answers_arc(Arc::new({
                let actual = actual.clone();
                let phase = phase.clone();
                let order = order.clone();
                move |_, request, prepared| {
                    assert_eq!(phase.load(Ordering::SeqCst), 1);
                    order.lock().unwrap().push("compose");
                    actual.compose_prepared(request, prepared)
                }
            })),
    ))
    .no_verify_in_drop();
    let workers = Unimock::new((
        RenderWorkersMock::cancelled
            .each_call(matching!())
            .returns(false),
        RenderWorkersMock::document
            .some_call(matching!(_, _))
            .answers_arc(Arc::new({
                let phase = phase.clone();
                let order = order.clone();
                let cache = cache.clone();
                move |_, route, job| {
                    assert_eq!(*order.lock().unwrap(), ["root", "handoff"]);
                    assert_eq!(
                        cache.stats().misses,
                        2,
                        "the lookup worker read and the fragment read precede composition"
                    );
                    phase.store(1, Ordering::SeqCst);
                    let artifact = job.artifact(route)?;
                    assert!(matches!(
                        job.artifact(route),
                        Err(GraphError::Internal(InternalError::PreparedRootConsumed))
                    ));
                    assert_eq!(
                        cache.stats().misses,
                        2,
                        "composition does not repeat the counted document read"
                    );
                    Ok(artifact)
                }
            })),
    ))
    .no_verify_in_drop();
    let completion = Unimock::new((
        CompletionMock::metadata_bytes
            .some_call(matching!())
            .returns(256_usize),
        CompletionMock::handoff
            .some_call(matching!(_))
            .answers_arc(Arc::new({
                let phase = phase.clone();
                let order = order.clone();
                move |_, _| {
                    assert_eq!(phase.load(Ordering::SeqCst), 0);
                    order.lock().unwrap().push("handoff");
                }
            })),
    ));
    let state = Arc::get_mut(&mut session.state).unwrap();
    state.composer = Arc::new(custom.clone());
    state.workers = Arc::new(workers.clone());
    let trace = Trace::default();
    let artifact = trace
        .in_scope(|| background(&session, &route("caller"), Arc::new(completion.clone())).unwrap());
    assert!(
        String::from_utf8(artifact.bytes.clone())
            .unwrap()
            .contains("<p>Prepared</p>")
    );
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(*order.lock().unwrap(), ["root", "handoff", "compose"]);
    assert_eq!(trace.closed("render.document").len(), 1);
}
