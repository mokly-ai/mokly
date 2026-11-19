//! Foreground work finishes while a base capture waits at the real admission gate.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumerMock;
use mokly_graph::workers::{ArtifactWorkerMock, ComparisonTaskMock, RenderWorkers, ThreadWorkers};
use mokly_server::changes::ChangeToken;
use mokly_server::foreground::Foreground;
use mokly_sidecar::methods::Call;
use mokly_sidecar::pool::PoolMock;
use mokly_sidecar::wire::MethodResult;
use unimock::{MockFn, Unimock, matching};

use crate::serve_capture_workers;
use crate::serve_pool::{PoolScheduling, ServePool};

use super::serve_pool_support::{capacity, css};

#[test]
fn a_base_capture_at_admission_does_not_take_the_foreground_render_worker() {
    let events = Arc::new(Mutex::new(Vec::new()));
    let recorded = events.clone();
    let inner = Unimock::new(
        PoolMock::request
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, call| {
                let Call::ProcessCss(params) = call else {
                    panic!("expected sidecar request")
                };
                recorded.lock().unwrap().push(params.source_root);
                Ok(MethodResult::Empty)
            })),
    );
    let scheduler = Arc::new(ServePool::new(Arc::new(inner.clone()), capacity(1)));
    let shared: Arc<dyn RenderWorkers> = Arc::new(ThreadWorkers::new(1).unwrap());
    let id = Arc::new(Mutex::new(None));
    let recorded_id = id.clone();
    let identify = Unimock::new(ComparisonTaskMock::run.each_call(matching!(_)).answers_arc(
        Arc::new(move |_, _| *recorded_id.lock().unwrap() = Some(thread::current().id())),
    ));
    shared.comparison_tasks(1, &identify);
    let (started, started_wait) = mpsc::channel();
    let workers = serve_capture_workers::workers(shared.clone(), scheduler.clone()).unwrap();
    let base = scheduler.pool(Some(Arc::new(ChangeToken::default())));
    let finished = Arc::new(AtomicBool::new(false));
    let completed = finished.clone();
    let task = Unimock::new(
        ComparisonTaskMock::run
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, _| {
                started.send(thread::current().id()).unwrap();
                assert!(matches!(
                    base.request(css("/base", 0)).unwrap(),
                    MethodResult::Empty
                ));
                completed.store(true, Ordering::SeqCst);
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
    let mut capture = Join(None);
    {
        let _foreground = scheduler.enter();
        let task = task.clone();
        let mut consumer = consumer.clone();
        capture.0 = Some(thread::spawn(move || {
            workers.capture_window(1, &task, &mut consumer)
        }));
        {
            let mut state = scheduler.gate.state.lock().unwrap();
            while state.waiting_base != 1 {
                state = scheduler.gate.changed.wait(state).unwrap();
            }
        }
        assert_ne!(
            started_wait.recv().unwrap(),
            id.lock().unwrap().unwrap(),
            "the base admission wait must hold no foreground worker"
        );
        let head = scheduler.pool(None);
        let render = Unimock::new(
            ArtifactWorkerMock::artifact
                .each_call(matching!("foreground"))
                .answers_arc(Arc::new(move |_, _| {
                    assert!(matches!(
                        head.request(css("/head", 0)).unwrap(),
                        MethodResult::Empty
                    ));
                    Ok(Arc::new(Artifact {
                        bytes: b"foreground".to_vec(),
                        document: None,
                        fragment: None,
                        content_type: "text/html".into(),
                    }))
                })),
        );
        assert_eq!(
            shared.document("foreground", &render).unwrap().bytes,
            b"foreground"
        );
        assert!(!finished.load(Ordering::SeqCst));
        assert_eq!(*events.lock().unwrap(), ["/head"]);
    }
    capture.0.take().unwrap().join().unwrap();
    assert!(finished.load(Ordering::SeqCst));
    assert_eq!(*events.lock().unwrap(), ["/head", "/base"]);
}

struct Join(Option<thread::JoinHandle<()>>);

impl Drop for Join {
    fn drop(&mut self) {
        if let Some(thread) = self.0.take() {
            thread.join().unwrap();
        }
    }
}
