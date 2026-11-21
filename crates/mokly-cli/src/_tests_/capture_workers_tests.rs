//! A blocked base capture leaves a foreground worker available.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_graph::background::{BackgroundRead, BackgroundWorkerMock};
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumerMock;
use mokly_graph::render_class::RenderClass;
use mokly_graph::workers::{ArtifactWorkerMock, ComparisonTaskMock, RenderWorkers, ThreadWorkers};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use super::{CaptureCapacityMock, CaptureWorkers};

#[test]
fn a_base_capture_wait_leaves_the_foreground_worker_available() {
    let shared: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(1).unwrap());
    let ids = Arc::new(Mutex::new(Vec::new()));
    let foreground_ids = ids.clone();
    let foreground = Unimock::new(
        ArtifactWorkerMock::artifact
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                foreground_ids.lock().unwrap().push(thread::current().id());
                Ok(Arc::new(Artifact {
                    bytes: route.as_bytes().to_vec(),
                    content_type: "text/html".into(),
                    document: None,
                    fragment: None,
                }))
            })),
    );
    assert_eq!(
        shared.document("before", &foreground).unwrap().bytes,
        b"before"
    );
    let capacity = Unimock::new(
        CaptureCapacityMock::capacity
            .each_call(matching!())
            .returns(1_usize),
    );
    let workers = CaptureWorkers {
        inner: shared.clone(),
        capture: Arc::new(ThreadWorkers::new(1).unwrap()),
        capacity: Arc::new(capacity.clone()),
    };
    let pending = Arc::new(AtomicBool::new(false));
    let running = pending.clone();
    let (started, receive) = mpsc::channel();
    let (release, wait) = mpsc::channel();
    let wait = Mutex::new(wait);
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                running.store(true, Ordering::SeqCst);
                started.send(thread::current().id()).unwrap();
                wait.lock().unwrap().recv().unwrap();
                running.store(false, Ordering::SeqCst);
            })),
    );
    let consumer = Unimock::new((
        CaptureConsumerMock::admit
            .each_call(matching!(_))
            .answers(&|_, index| index == 0),
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .returns(true),
    ));
    let background_task = task.clone();
    let mut background_consumer = consumer.clone();
    let capture = thread::spawn(move || {
        workers.capture_window(1, &background_task, &mut background_consumer)
    });
    let release = Release(release);
    let base = receive.recv().unwrap();
    assert_ne!(
        base,
        ids.lock().unwrap()[0],
        "base admission must hold no foreground worker"
    );
    assert_eq!(
        shared.document("foreground", &foreground).unwrap().bytes,
        b"foreground"
    );
    assert!(
        pending.load(Ordering::SeqCst),
        "the foreground result must arrive while base work waits"
    );
    release.0.send(()).unwrap();
    capture.join().unwrap();
    assert_eq!(ids.lock().unwrap().len(), 2);
}

struct Release(mpsc::Sender<()>);

impl Drop for Release {
    fn drop(&mut self) {
        let _ = self.0.send(());
    }
}

#[test]
fn background_lookup_reuses_the_inner_worker_without_capture_capacity_reads() {
    let inner: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(1).unwrap());
    let capacity_reads = Arc::new(AtomicUsize::new(0));
    let reads = capacity_reads.clone();
    let workers = CaptureWorkers {
        inner: inner.clone(),
        capture: Arc::new(ThreadWorkers::new(1).unwrap()),
        capacity: Arc::new(
            Unimock::new(
                CaptureCapacityMock::capacity
                    .each_call(matching!())
                    .answers_arc(Arc::new(move |_| {
                        reads.fetch_add(1, Ordering::SeqCst);
                        1
                    }))
                    .at_least_times(0),
            )
            .no_verify_in_drop(),
        ),
    };
    let observed = Arc::new(Mutex::new(Vec::new()));
    let recorded = observed.clone();
    let job = Unimock::new(
        BackgroundWorkerMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, route| {
                recorded.lock().unwrap().push((
                    thread::current().id(),
                    RenderClass::current(),
                    tracing::Span::current()
                        .metadata()
                        .map(|value| value.name()),
                ));
                Ok(BackgroundRead::Complete(Arc::new(Artifact {
                    bytes: route.as_bytes().to_vec(),
                    document: None,
                    fragment: None,
                    content_type: "text/html".into(),
                })))
            })),
    );
    Trace::default().in_scope(|| {
        RenderClass::Background.in_scope(|| {
            tracing::info_span!("capture.lookup").in_scope(|| {
                for (worker, route) in [(inner.as_ref(), "direct"), (&workers, "wrapped")] {
                    let BackgroundRead::Complete(artifact) =
                        worker.background(route, &job).unwrap()
                    else {
                        panic!("a completed lookup must keep its result");
                    };
                    assert_eq!(artifact.bytes, route.as_bytes());
                }
            });
        });
    });
    let observed = observed.lock().unwrap();
    assert_eq!(observed.len(), 2);
    assert_ne!(observed[0].0, thread::current().id());
    assert_eq!(
        observed[1].0, observed[0].0,
        "lookup must reuse the ordinary worker"
    );
    for (_, class, span) in observed.iter() {
        assert_eq!(*class, RenderClass::Background);
        assert_eq!(*span, Some("capture.lookup"));
    }
    assert_eq!(capacity_reads.load(Ordering::SeqCst), 0);
}
