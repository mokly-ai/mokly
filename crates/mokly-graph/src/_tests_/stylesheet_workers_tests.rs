//! Stylesheet jobs overlap on the render pool and return their results in root order.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::Duration;

use mokly_css::types::{Bundle, StylesheetRoot};

use crate::error::{Result, invalid};
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

/// The first root waits until the last root has started, which needs two workers.
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
        if root.path == "c.css" {
            return Err(invalid(&root.path, "fixture failure"));
        }
        Ok(bundle(root))
    }
}

fn overlapping() -> Overlapping {
    let (started, wait) = mpsc::channel();
    Overlapping {
        started,
        wait: Mutex::new(wait),
        timed_out: AtomicBool::new(false),
        order: Mutex::new(Vec::new()),
    }
}

#[test]
fn stylesheet_jobs_overlap_on_the_pool_and_keep_root_order_and_failures() {
    let workers = ThreadWorkers::new(2).unwrap();
    let jobs = overlapping();
    let roots = [root("a.css"), root("b.css"), root("c.css")];
    let results = workers.stylesheets(&roots, &jobs);
    assert!(!jobs.timed_out.load(Ordering::SeqCst));
    let order = jobs.order.lock().unwrap();
    assert_ne!(order.first().map(String::as_str), Some("a.css"));
    assert_eq!(results.len(), 3);
    assert_eq!(results[0].as_ref().unwrap().route, "styles/a.css");
    assert_eq!(results[1].as_ref().unwrap().route, "styles/b.css");
    assert!(results[2].is_err());
}

struct Serial;

impl RenderWorkers for Serial {
    fn run(&self, _routes: &[String], _worker: &dyn DocumentWorker) -> Vec<Result<ValidatedView>> {
        Vec::new()
    }
}

struct Recording(Mutex<Vec<String>>);

impl StylesheetWorker for Recording {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        self.0.lock().unwrap().push(root.path.clone());
        Ok(bundle(root))
    }
}

#[test]
fn the_default_scheduler_bundles_each_root_once_in_root_order() {
    let jobs = Recording(Mutex::new(Vec::new()));
    let roots = [root("a.css"), root("b.css"), root("c.css")];
    let routes: Vec<_> = Serial
        .stylesheets(&roots, &jobs)
        .into_iter()
        .map(|bundle| bundle.unwrap().route)
        .collect();
    assert_eq!(routes, ["styles/a.css", "styles/b.css", "styles/c.css"]);
    assert_eq!(*jobs.0.lock().unwrap(), ["a.css", "b.css", "c.css"]);
}
