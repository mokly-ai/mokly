//! Serial stylesheet roots stay on the calling thread while other jobs use the inner workers.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};
use std::thread::{self, ThreadId};

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::background::{BackgroundRead, BackgroundWorkerMock};
use mokly_graph::cache::Artifact;
use mokly_graph::capture_window::CaptureConsumerMock;
use mokly_graph::closure::Closure;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::render_class::RenderClass;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonTask, DocumentWorker, RenderWorkers, RenderWorkersMock,
    StylesheetWorker, ThreadWorkers, ValidatedView,
};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use mokly_test_support::capture::Trace;
use unimock::{MockFn, Unimock, matching};

use crate::cancellation::CancellationMock;
use crate::cancelled_work::CancellableWorkers;
use crate::serial_stylesheets::SerialStylesheets;

pub(crate) fn root(path: &str) -> StylesheetRoot {
    StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

/// Records the thread and the root of each job and fails `c.css`.
#[derive(Default)]
pub(crate) struct Threads(pub(crate) Mutex<Vec<(ThreadId, String)>>);

impl StylesheetWorker for Threads {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        self.0
            .lock()
            .unwrap()
            .push((thread::current().id(), root.path.clone()));
        if root.path == "c.css" {
            return Err(GraphError::Runtime {
                source: RuntimeDiagnostic {
                    code: RuntimeCode::Cancelled,
                    message: root.path.clone(),
                },
            });
        }
        Ok(Bundle {
            read_evidence: Default::default(),
            route: format!("styles/{}", root.path),
            css: String::new(),
            assets: BTreeMap::new(),
            resolution_files: Default::default(),
            resolution_roots: Default::default(),
            css_module_named_exports: Default::default(),
            css_modules: BTreeMap::new(),
            inputs: BTreeMap::new(),
            imported_by: BTreeMap::new(),
            repository_aliases: BTreeSet::new(),
            dependency_digests: BTreeMap::new(),
            plugin_inputs: BTreeMap::new(),
            directories: Vec::new(),
        })
    }
}

#[test]
fn stylesheet_roots_run_in_order_on_the_caller_and_stop_at_the_first_failure() {
    let workers = SerialStylesheets {
        inner: Arc::new(ThreadWorkers::new(4).unwrap()),
    };
    let jobs = Threads::default();
    let roots = [root("a.css"), root("b.css")];
    assert_eq!(workers.stylesheets(&roots, &jobs).unwrap().len(), 2);
    let failing = [root("c.css"), root("d.css")];
    assert!(matches!(
        workers.stylesheets(&failing, &jobs),
        Err(GraphError::Runtime { source }) if source.message == "c.css"
    ));
    let current = thread::current().id();
    let jobs = jobs.0.lock().unwrap();
    assert!(jobs.iter().all(|(thread, _)| *thread == current));
    let paths: Vec<_> = jobs.iter().map(|(_, path)| path.as_str()).collect();
    assert_eq!(paths, ["a.css", "b.css", "c.css"]);
}

/// The inner mocks answer without calling any job.
struct Unused;

impl ArtifactWorker for Unused {
    fn artifact(&self, _route: &str) -> Result<Arc<Artifact>> {
        unreachable!("the inner workers answer without the job")
    }
    fn closure_job(&self, _route: &str) -> Result<Closure> {
        unreachable!("the inner workers answer without the job")
    }
}

impl ComparisonTask for Unused {
    fn run(&self, _index: usize) {
        unreachable!("the inner workers answer without the job")
    }
}

impl DocumentWorker for Unused {
    fn validate(&self, _route: &str) -> Result<ValidatedView> {
        unreachable!("the inner workers answer without the job")
    }
}

#[test]
fn every_other_job_reaches_the_inner_workers() {
    let artifact = Arc::new(Artifact {
        bytes: Vec::new(),
        document: None,
        fragment: None,
        content_type: "text/html".into(),
    });
    let workers = SerialStylesheets {
        inner: Arc::new(Unimock::new((
            RenderWorkersMock::comparison_parallelism
                .next_call(matching!())
                .returns(3_usize),
            RenderWorkersMock::capture_window
                .next_call(matching!(_, _, _))
                .answers(&|_, _, _, consumer| {
                    consumer.complete(0);
                }),
            RenderWorkersMock::cancelled
                .next_call(matching!())
                .returns(true),
            RenderWorkersMock::closure
                .next_call(matching!(_, _))
                .answers(&|_, _, _| Ok(Default::default())),
            RenderWorkersMock::document
                .next_call(matching!(_, _))
                .answers_arc(Arc::new(move |_, _, _| Ok(artifact.clone()))),
            RenderWorkersMock::run
                .next_call(matching!(_, _))
                .answers(&|_, _, _| Vec::new()),
        ))),
    };
    let unused = Unused;
    assert_eq!(workers.comparison_parallelism(), 3);
    let completed = Arc::new(Mutex::new(Vec::new()));
    let recorded = completed.clone();
    let mut consumer = Unimock::new(
        CaptureConsumerMock::complete
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, index| {
                recorded.lock().unwrap().push(index);
                true
            }))
            .at_least_times(0),
    );
    workers.capture_window(3, &unused, &mut consumer);
    assert_eq!(*completed.lock().unwrap(), [0]);
    assert!(workers.cancelled());
    assert!(workers.closure("page", &unused).is_ok());
    assert!(workers.document("page", &unused).is_ok());
    assert!(workers.run(&[], &unused).is_empty());
}

#[test]
fn background_lookup_uses_the_existing_worker_through_both_wrappers() {
    let threads = Arc::new(ThreadWorkers::new(1).unwrap());
    let workers = SerialStylesheets {
        inner: Arc::new(CancellableWorkers {
            inner: threads.clone(),
            cancellation: Arc::new(Unimock::new(
                CancellationMock::requested
                    .each_call(matching!())
                    .returns(false),
            )),
        }),
    };
    let observed = Arc::new(Mutex::new(Vec::new()));
    let caller = thread::current().id();
    let job = Unimock::new(
        BackgroundWorkerMock::read
            .each_call(matching!(_))
            .answers_arc(Arc::new({
                let observed = observed.clone();
                move |_, route| {
                    observed.lock().unwrap().push((
                        thread::current().id(),
                        RenderClass::current(),
                        tracing::Span::current().metadata().unwrap().name(),
                        route.to_owned(),
                    ));
                    Ok(BackgroundRead::Complete(Arc::new(Artifact {
                        bytes: route.as_bytes().to_vec(),
                        document: None,
                        fragment: None,
                        content_type: "text/html".into(),
                    })))
                }
            })),
    );
    let trace = Trace::default();
    trace.in_scope(|| {
        RenderClass::Background.in_scope(|| {
            let span = tracing::info_span!("worker.lookup");
            span.in_scope(|| {
                assert!(matches!(
                    threads.background("direct", &job).unwrap(),
                    BackgroundRead::Complete(_)
                ));
                let BackgroundRead::Complete(artifact) =
                    workers.background("wrapped", &job).unwrap()
                else {
                    panic!("a completed lookup must keep its result");
                };
                assert_eq!(artifact.bytes, b"wrapped");
            });
        })
    });
    let observed = observed.lock().unwrap();
    assert_eq!(observed.len(), 2);
    assert_ne!(observed[0].0, caller);
    assert_eq!(
        observed[1].0, observed[0].0,
        "the wrappers must reuse the existing worker"
    );
    assert_eq!(observed[0].1, RenderClass::Background);
    assert_eq!(observed[1].1, RenderClass::Background);
    assert_eq!(observed[0].2, "worker.lookup");
    assert_eq!(observed[1].2, "worker.lookup");
    assert_eq!(observed[0].3, "direct");
    assert_eq!(observed[1].3, "wrapped");
}
