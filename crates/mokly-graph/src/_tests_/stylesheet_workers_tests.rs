//! Stylesheet jobs overlap on the render pool and return their results in root order.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::Duration;

use mokly_css::types::{Bundle, StylesheetRoot};

use crate::error::{GraphError, Result, invalid};
use crate::workers::{
    DocumentWorker, RenderWorkers, StylesheetWorker, ThreadWorkers, ValidatedView,
};

const DEADLINE: Duration = Duration::from_secs(30);

fn root(path: &str) -> StylesheetRoot {
    StylesheetRoot {
        path: path.into(),
        stylesheets: vec![path.into()],
        excluded: BTreeSet::new(),
        local_css: true,
    }
}

fn bundle(root: &StylesheetRoot) -> Bundle {
    Bundle {
        read_evidence: Default::default(),
        route: format!("styles/{}", root.path),
        css: format!("/* {} */\n", root.path),
        assets: BTreeMap::new(),
        css_modules: BTreeMap::new(),
        inputs: BTreeMap::new(),
        imported_by: BTreeMap::new(),
        repository_aliases: BTreeSet::new(),
        dependency_digests: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    }
}

/// The first root waits until another root has started, which needs two workers.
struct Overlapping {
    started: Sender<()>,
    wait: Mutex<Receiver<()>>,
    timed_out: AtomicBool,
    order: Mutex<Vec<String>>,
}

impl StylesheetWorker for Overlapping {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        if root.path == "a.css" {
            let waited = self.wait.lock().unwrap().recv_timeout(DEADLINE);
            self.timed_out.store(waited.is_err(), Ordering::SeqCst);
            self.order.lock().unwrap().push(root.path.clone());
        } else {
            self.order.lock().unwrap().push(root.path.clone());
            self.started.send(()).unwrap();
        }
        Ok(bundle(root))
    }
}

#[test]
fn stylesheet_jobs_overlap_on_the_pool_and_keep_root_order() {
    let (started, wait) = mpsc::channel();
    let jobs = Overlapping {
        started,
        wait: Mutex::new(wait),
        timed_out: AtomicBool::new(false),
        order: Mutex::new(Vec::new()),
    };
    let roots = [root("a.css"), root("b.css"), root("c.css")];
    let routes: Vec<_> = ThreadWorkers::new(2)
        .unwrap()
        .stylesheets(&roots, &jobs)
        .unwrap()
        .into_iter()
        .map(|bundle| bundle.route)
        .collect();
    assert!(!jobs.timed_out.load(Ordering::SeqCst));
    assert_ne!(jobs.order.lock().unwrap()[0], "a.css");
    assert_eq!(routes, ["styles/a.css", "styles/b.css", "styles/c.css"]);
}

struct Serial;

impl RenderWorkers for Serial {
    fn run(&self, _routes: &[String], _worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        Vec::new()
    }
}

/// Records each started root and fails `b.css`.
struct Recording(Mutex<Vec<String>>);

impl StylesheetWorker for Recording {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        self.0.lock().unwrap().push(root.path.clone());
        if root.path == "b.css" {
            return Err(invalid(&root.path, "fixture failure"));
        }
        Ok(bundle(root))
    }
}

#[test]
fn both_schedulers_return_the_first_failure_and_start_no_later_root() {
    let roots = [root("a.css"), root("b.css"), root("c.css"), root("d.css")];
    let serial = Recording(Mutex::new(Vec::new()));
    let pooled = Recording(Mutex::new(Vec::new()));
    let schedulers: [(&dyn RenderWorkers, &Recording); 2] = [
        (&Serial, &serial),
        (&ThreadWorkers::new(1).unwrap(), &pooled),
    ];
    for (scheduler, jobs) in schedulers {
        let Err(GraphError::Invalid { route, .. }) = scheduler.stylesheets(&roots, jobs) else {
            panic!("expected the failure of b.css")
        };
        assert_eq!(route, "b.css");
        assert_eq!(*jobs.0.lock().unwrap(), ["a.css", "b.css"]);
    }
}
