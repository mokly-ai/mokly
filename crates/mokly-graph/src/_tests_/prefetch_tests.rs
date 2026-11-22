//! Known misses start before capture and stay within their classification lifetime.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_html::composition::ComposerMock;
use mokly_model::runtime_diagnostic::RuntimeCode;
use unimock::{MockFn, Unimock, matching};

use crate::cache::MemoryCache;
use crate::collection::ComparisonCollectorMock;
use crate::error::GraphError;
use crate::types::RenderGeneration;
use crate::workers::{RenderWorkers, RenderWorkersMock, ThreadWorkers};

use super::collection_support;

#[test]
fn prepared_keys_list_only_missing_documents_without_restoring_cached_views() {
    let mut probe = collection_support::probe(4);
    collection_support::warm(&probe);
    let cache = Arc::new(MemoryCache::new(1024 * 1024, 512 * 1024));
    Arc::get_mut(&mut probe.session.state).unwrap().cache = cache;
    for route in [
        "page-000/index.html",
        "page-001/index.html",
        "page-002/index.html",
    ] {
        probe.session.comparison_input(route).unwrap();
    }
    probe.renders.lock().unwrap().clear();
    assert_eq!(probe.session.uncached_documents(), ["page-003/index.html"]);
    assert!(probe.renders.lock().unwrap().is_empty());
}

#[test]
fn known_misses_start_before_capture_and_share_their_inflight_result() {
    let (probe, started, release) = controlled(4, 3, "page-003");
    let guard = probe.session.prefetch_comparison().unwrap();
    assert!(
        guard.is_some(),
        "known misses must start before ordered capture"
    );
    assert_eq!(started.recv().unwrap(), "page-003");
    assert_eq!(*probe.renders.lock().unwrap(), ["page-003"]);
    let flights = probe
        .session
        .state
        .prefetch
        .lock()
        .unwrap()
        .clone()
        .unwrap();
    let routes = Arc::new(Mutex::new(Vec::new()));
    let received = routes.clone();
    let generation = probe.session.clone();
    let capture = thread::spawn(move || {
        let mut collector = Unimock::new(
            ComparisonCollectorMock::collect
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, route, input| {
                    assert!(
                        String::from_utf8_lossy(&input.document.restore().unwrap().bytes)
                            .contains("id=\"anchor\"")
                    );
                    received.lock().unwrap().push(route.to_owned());
                    Ok(())
                })),
        );
        generation.collect_comparison(&mut collector).unwrap()
    });
    let joined = flights.wait_for_reader("page-003/index.html");
    release.send(()).unwrap();
    assert_eq!(capture.join().unwrap().documents, 4);
    {
        let _guard = guard;
    }
    assert!(
        joined,
        "capture must wait for the in-flight render instead of composing it again"
    );
    assert_eq!(*probe.renders.lock().unwrap(), ["page-003"]);
    assert_eq!(
        *routes.lock().unwrap(),
        [
            "page-000/index.html",
            "page-001/index.html",
            "page-002/index.html",
            "page-003/index.html"
        ]
    );
    assert!(probe.session.state.prefetch.lock().unwrap().is_none());
}

fn controlled(
    count: usize,
    cached: usize,
    blocked: &'static str,
) -> (
    collection_support::Probe,
    mpsc::Receiver<String>,
    mpsc::Sender<()>,
) {
    let mut probe = collection_support::probe(count);
    collection_support::warm(&probe);
    Arc::get_mut(&mut probe.session.state).unwrap().cache =
        Arc::new(MemoryCache::new(1024 * 1024, 0));
    for index in 0..cached {
        probe
            .session
            .comparison_input(&format!("page-{index:03}/index.html"))
            .unwrap();
    }
    probe.renders.lock().unwrap().clear();
    let (started, receive) = mpsc::channel();
    let (release, wait) = mpsc::channel();
    let wait = Mutex::new(wait);
    let state = Arc::get_mut(&mut probe.session.state).unwrap();
    let composer = state.composer.clone();
    let first = AtomicBool::new(true);
    state.composer = Arc::new(Unimock::new(
        ComposerMock::compose
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request| {
                let composed = composer.compose(request)?;
                if request.entry.metadata.path == blocked && first.swap(false, Ordering::SeqCst) {
                    started.send(blocked.into()).unwrap();
                    wait.lock().unwrap().recv().unwrap();
                }
                Ok(composed)
            })),
    ));
    let workers: Arc<dyn RenderWorkers> =
        Arc::new(ThreadWorkers::new(if cached > 0 { 2 } else { 1 }).unwrap());
    let cancelled = probe.cancelled.clone();
    let prefetch = workers.clone();
    state.workers = if cached > 0 {
        Arc::new(Unimock::new((
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| cancelled.load(Ordering::SeqCst))),
            RenderWorkersMock::prefetch_tasks
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, count, task| {
                    prefetch.prefetch_tasks(count, task)
                })),
            RenderWorkersMock::capture_window
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, limit, task, consumer| {
                    workers.capture_window(limit, task, consumer)
                })),
        )))
    } else {
        Arc::new(Unimock::new((
            RenderWorkersMock::cancelled
                .each_call(matching!())
                .answers_arc(Arc::new(move |_| cancelled.load(Ordering::SeqCst))),
            RenderWorkersMock::prefetch_tasks
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, count, task| {
                    prefetch.prefetch_tasks(count, task)
                })),
        )))
    };
    (probe, receive, release)
}

#[test]
fn dropping_early_work_stops_queued_misses_and_joins_before_the_generation_is_kept() {
    let (probe, started, release) = controlled(4, 0, "page-000");
    let guard = probe.session.prefetch_comparison().unwrap();
    assert!(guard.is_some());
    assert_eq!(started.recv().unwrap(), "page-000");
    let flights = probe
        .session
        .state
        .prefetch
        .lock()
        .unwrap()
        .clone()
        .unwrap();
    let joined = Arc::new(AtomicBool::new(false));
    let completed = joined.clone();
    let stopping = thread::spawn(move || {
        {
            let _guard = guard;
        }
        completed.store(true, Ordering::SeqCst);
    });
    flights.wait_for_stop("page-000/index.html");
    assert!(
        !joined.load(Ordering::SeqCst),
        "drop must wait for its active render"
    );
    release.send(()).unwrap();
    stopping.join().unwrap();
    assert!(joined.load(Ordering::SeqCst));
    assert_eq!(*probe.renders.lock().unwrap(), ["page-000"]);
    assert!(probe.session.state.prefetch.lock().unwrap().is_none());
    let input = probe
        .session
        .comparison_input("page-001/index.html")
        .unwrap();
    assert!(String::from_utf8_lossy(&input.artifact.bytes).contains("page-001"));
    assert_eq!(*probe.renders.lock().unwrap(), ["page-000", "page-001"]);
}

#[test]
fn classification_cancellation_stops_early_misses_before_another_render() {
    let (probe, started, release) = controlled(4, 0, "page-000");
    let guard = probe.session.prefetch_comparison().unwrap();
    assert!(guard.is_some());
    assert_eq!(started.recv().unwrap(), "page-000");
    let flights = probe
        .session
        .state
        .prefetch
        .lock()
        .unwrap()
        .clone()
        .unwrap();
    probe.cancelled.store(true, Ordering::SeqCst);
    release.send(()).unwrap();
    flights.wait_for_completion("page-001/index.html");
    {
        let _guard = guard;
    }
    let GraphError::Runtime { source } = probe.session.check_cancelled().unwrap_err() else {
        panic!("expected classification cancellation");
    };
    assert_eq!(source.code, RuntimeCode::Cancelled);
    assert_eq!(*probe.renders.lock().unwrap(), ["page-000"]);
    assert!(probe.session.state.prefetch.lock().unwrap().is_none());
}
