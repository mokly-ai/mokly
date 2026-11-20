//! Out-of-order worker completion preserves ordered capture and validation.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_html::composition::ComposerMock;
use unimock::{MockFn, Unimock, matching};

use crate::collection::ComparisonCollectorMock;
use crate::collection_input::{ComparisonEncoder, ComparisonEncoderMock, DocumentEncoder};
use crate::document_codec::EncodedView;
use crate::error::GraphError;
use crate::types::RenderGeneration;
use crate::workers::{ComparisonTask, RenderWorkers, RenderWorkersMock, ThreadWorkers};

use super::collection_support;

#[test]
fn out_of_order_completions_keep_route_commits_and_validation_failures_ordered() {
    for failing in [false, true] {
        let mut probe = collection_support::probe(4);
        collection_support::warm(&probe);
        if failing {
            probe
                .options
                .lock()
                .unwrap()
                .invalid
                .extend(["page-001".into(), "page-003".into()]);
        }
        let caller = thread::current().id();
        let pending = Arc::new(AtomicBool::new(false));
        let overlap = Arc::new(AtomicBool::new(false));
        let running = pending.clone();
        let observed = overlap.clone();
        let (release, wait) = mpsc::channel();
        let (started, started_wait) = mpsc::channel();
        let started_wait = Mutex::new(started_wait);
        let wait = Mutex::new(wait);
        let (failure_release, failure_wait) = mpsc::channel();
        let failure_wait = Mutex::new(failure_wait);
        let (failure_started, first_wait) = mpsc::channel();
        let first_wait = Mutex::new(first_wait);
        let state = Arc::get_mut(&mut probe.session.state).unwrap();
        let composer = state.composer.clone();
        state.composer = Arc::new(Unimock::new(
            ComposerMock::compose
                .each_call(matching!(_))
                .answers_arc(Arc::new(move |_, request| {
                    if thread::current().id() != caller {
                        let path = request.entry.metadata.path.as_str();
                        if failing {
                            match path {
                                "page-000" => first_wait.lock().unwrap().recv().unwrap(),
                                "page-001" => {
                                    running.store(true, Ordering::SeqCst);
                                    failure_started.send(()).unwrap();
                                    failure_wait.lock().unwrap().recv().unwrap();
                                    running.store(false, Ordering::SeqCst);
                                }
                                "page-003" => {
                                    observed.store(running.load(Ordering::SeqCst), Ordering::SeqCst)
                                }
                                _ => {}
                            }
                        } else {
                            match path {
                                "page-000" => {
                                    running.store(true, Ordering::SeqCst);
                                    started.send(()).unwrap();
                                    wait.lock().unwrap().recv().unwrap();
                                    running.store(false, Ordering::SeqCst);
                                }
                                "page-001" => started_wait.lock().unwrap().recv().unwrap(),
                                "page-002" => {
                                    observed
                                        .store(running.load(Ordering::SeqCst), Ordering::SeqCst);
                                    release.send(()).unwrap();
                                }
                                _ => {}
                            }
                        }
                    }
                    composer.compose(request)
                })),
        ));
        let pool = ThreadWorkers::new(2).unwrap();
        let completed = Arc::new(Mutex::new(Vec::new()));
        let finished = completed.clone();
        state.workers = Arc::new(Unimock::new((
            RenderWorkersMock::capture_parallelism
                .each_call(matching!())
                .returns(2_usize),
            RenderWorkersMock::capture_window
                .each_call(matching!(_, _, _))
                .answers_arc(Arc::new(move |_, limit, task, consumer| {
                    pool.capture_window(
                        limit,
                        &ObservedTask {
                            inner: task,
                            completed: &finished,
                            release: &failure_release,
                            failing,
                        },
                        consumer,
                    );
                })),
        )));
        let received = Arc::new(Mutex::new(Vec::new()));
        let recorded = received.clone();
        let decoded = Arc::new(Mutex::new(BTreeMap::new()));
        let inputs = decoded.clone();
        let encoder = Unimock::new(
            ComparisonEncoderMock::encode
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, route, input| {
                    assert_ne!(
                        thread::current().id(),
                        caller,
                        "capture encoding must run on workers"
                    );
                    inputs
                        .lock()
                        .unwrap()
                        .insert(route.to_owned(), Arc::downgrade(&input.artifact));
                    DocumentEncoder.encode(route, input)
                })),
        );
        let encoder: Arc<dyn ComparisonEncoder> = Arc::new(encoder.clone());
        let mut collector = Unimock::new((
            ComparisonCollectorMock::remaining
                .each_call(matching!())
                .returns(16 * 1024_usize),
            ComparisonCollectorMock::encoder
                .each_call(matching!())
                .returns(encoder),
            ComparisonCollectorMock::collect
                .each_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, route, input| {
                    assert!(
                        decoded.lock().unwrap()[route].upgrade().is_none(),
                        "ordered consumption must hold no decoded input"
                    );
                    let restored = input.document.restore().unwrap();
                    assert!(String::from_utf8_lossy(&restored.bytes).contains("id=\"anchor\""));
                    assert_eq!(
                        input.identity,
                        EncodedView::comparison_identity(&restored).unwrap(),
                        "worker encoding must preserve the exact document identity"
                    );
                    recorded.lock().unwrap().push(route.to_owned());
                    Ok(())
                })),
        ));
        let result = probe.session.collect_comparison(&mut collector);
        assert!(
            overlap.load(Ordering::SeqCst),
            "a later route must finish while an earlier route waits"
        );
        let completed = completed.lock().unwrap();
        let inversion = completed.iter().position(|index| *index == 3).unwrap()
            < completed.iter().position(|index| *index == 1).unwrap();
        assert_eq!(
            inversion, failing,
            "the failing case must finish route 3 before route 1"
        );
        let expected = if failing {
            vec!["page-000/index.html", "page-002/index.html"]
        } else {
            vec![
                "page-000/index.html",
                "page-001/index.html",
                "page-002/index.html",
                "page-003/index.html",
            ]
        };
        assert_eq!(*received.lock().unwrap(), expected);
        let outcome = match result {
            Ok(summary) => (Some(summary.documents), Vec::new()),
            Err(GraphError::Attempt { failures, .. }) => (
                None,
                failures
                    .into_iter()
                    .map(|failure| match failure {
                        GraphError::Document { entry, .. } => entry,
                        _ => panic!("expected document failure"),
                    })
                    .collect(),
            ),
            Err(error) => panic!("unexpected validation error: {error}"),
        };
        let expected = if failing {
            (None, vec!["page-001".to_owned(), "page-003".to_owned()])
        } else {
            (Some(4), Vec::new())
        };
        assert_eq!(outcome, expected);
    }
}

struct ObservedTask<'a> {
    inner: &'a dyn ComparisonTask,
    completed: &'a Mutex<Vec<usize>>,
    release: &'a mpsc::Sender<()>,
    failing: bool,
}

impl ComparisonTask for ObservedTask<'_> {
    fn run(&self, index: usize) {
        self.inner.run(index);
        self.completed.lock().unwrap().push(index);
        if self.failing && index == 3 {
            self.release.send(()).unwrap();
        }
    }
}
