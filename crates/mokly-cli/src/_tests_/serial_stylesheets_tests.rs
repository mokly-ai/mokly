//! Serial stylesheet roots stay on the calling thread while other jobs use the inner workers.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};
use std::thread::{self, ThreadId};

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_graph::cache::Artifact;
use mokly_graph::closure::Closure;
use mokly_graph::error::{GraphError, Result};
use mokly_graph::types::ComparisonDocument;
use mokly_graph::workers::{
    ArtifactWorker, ComparisonWorker, DocumentWorker, RenderWorkers, RenderWorkersMock,
    StylesheetWorker, ThreadWorkers, ValidatedView,
};
use mokly_model::runtime_diagnostic::{RuntimeCode, RuntimeDiagnostic};
use unimock::{MockFn, Unimock, matching};

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

impl ComparisonWorker for Unused {
    fn input(&self, _route: &str) -> Result<ComparisonDocument> {
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
            RenderWorkersMock::comparison
                .next_call(matching!(_, _))
                .answers(&|_, _, _| Vec::new()),
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
    assert!(workers.comparison(&[], &unused).is_empty());
    assert!(workers.cancelled());
    assert!(workers.closure("page", &unused).is_ok());
    assert!(workers.document("page", &unused).is_ok());
    assert!(workers.run(&[], &unused).is_empty());
}
