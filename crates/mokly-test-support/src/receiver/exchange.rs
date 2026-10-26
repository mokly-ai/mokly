//! The receiver's options, its recorded requests, and its lifecycle.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::panic::{self, AssertUnwindSafe};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};

use serde_json::Value;

use crate::files;
use crate::inventory::{self, Owned};
use crate::process::BuildDirectory;
use crate::server::{Request, Response, Server};

use super::routes;

/// How the first Complete asks the client to plan again.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Replan {
    /// Forget the first missing blob, then ask for a new Plan.
    Nonempty,
    /// Ask for a new Plan with every blob present.
    Empty,
}

/// A callback that a held request runs before it waits for the receiver to close.
pub type Hold = Arc<dyn Fn() + Send + Sync>;

/// A check of the received inventory that runs before Complete succeeds.
pub type CompletionCheck = Box<dyn Fn(&BTreeMap<String, Vec<u8>>) + Send + Sync>;

/// How the fake receiver answers.
#[derive(Clone, Default)]
pub struct Options {
    /// Answer the first Plan, each first Blob, and the first Complete with this status.
    pub retry_status: Option<u16>,
    /// The expected bearer token instead of the default test token.
    pub token: Option<String>,
    /// Answer every Plan with this status, until `Exchange::set_plan_status` changes it.
    pub plan_status: Option<u16>,
    /// Ask for one new Plan at the first Complete.
    pub replan: Option<Replan>,
    /// Hold each Plan after the receiver records it.
    pub hold_plan: Option<Hold>,
    /// Hold each Blob after the receiver checks its digest.
    pub hold_blob: Option<Hold>,
}

/// What the receiver recorded so far.
#[derive(Clone, Debug, Default)]
pub struct Record {
    /// The compressed body of each Plan request.
    pub bodies: Vec<Vec<u8>>,
    /// Blob requests by digest.
    pub attempts: BTreeMap<String, usize>,
    /// The upload metadata of each Plan request.
    pub metadata: Vec<Value>,
    /// The sorted missing digests of each Plan answer.
    pub missing_sets: Vec<Vec<String>>,
    /// The complete inventory of each successful Complete.
    pub completed_inventories: Vec<BTreeMap<String, Vec<u8>>>,
    /// Complete requests, including retried ones.
    pub completion_attempts: usize,
    /// Successful Complete requests.
    pub completed: usize,
}

impl Record {
    /// The number of missing digests in each Plan answer.
    pub fn missing_counts(&self) -> Vec<usize> {
        self.missing_sets.iter().map(Vec::len).collect()
    }
}

/// The receiver state that the server threads share.
#[derive(Default)]
pub(super) struct State {
    pub(super) record: Record,
    pub(super) blobs: HashMap<String, Vec<u8>>,
    pub(super) entries: Vec<Owned>,
    pub(super) marker: Option<Vec<u8>>,
    pub(super) identity: String,
    pub(super) published: HashSet<String>,
}

/// Everything that the request handler reads and changes.
pub(super) struct Shared {
    pub(super) options: Options,
    pub(super) state: Mutex<State>,
    pub(super) check: Mutex<Option<Arc<CompletionCheck>>>,
    pub(super) base: OnceLock<String>,
    pub(super) plan_status: Mutex<Option<u16>>,
    active_blobs: AtomicUsize,
    max_blobs: AtomicUsize,
    failure: Mutex<Option<String>>,
    released: (Mutex<bool>, Condvar),
}

impl Shared {
    /// Run `callback`, then wait until the receiver closes, and fail the request.
    pub(super) fn hold(&self, callback: &Hold) -> Response {
        callback();
        let (released, changed) = &self.released;
        let _released = changed
            .wait_while(released.lock().unwrap(), |released| !*released)
            .unwrap();
        Response::empty(503, &[])
    }
}

/// A running fake receiver.
pub struct Exchange {
    shared: Arc<Shared>,
    server: Option<Server>,
    /// The Plan endpoint, with a query that the client must keep.
    pub endpoint: String,
}

impl Exchange {
    /// Start a receiver with `options`.
    pub fn start(options: Options) -> Self {
        let shared = Arc::new(Shared {
            plan_status: Mutex::new(options.plan_status),
            options,
            state: Mutex::default(),
            check: Mutex::default(),
            base: OnceLock::new(),
            active_blobs: AtomicUsize::new(0),
            max_blobs: AtomicUsize::new(0),
            failure: Mutex::default(),
            released: (Mutex::new(false), Condvar::new()),
        });
        let handler = Arc::clone(&shared);
        let server = Server::concurrent(Arc::new(move |request| answer(&handler, request)));
        shared.base.set(server.origin.clone()).unwrap();
        Self {
            endpoint: format!("{}/plan?key=1=2", server.origin),
            shared,
            server: Some(server),
        }
    }

    /// Answer every later Plan with `status`, or plan normally with `None`.
    pub fn set_plan_status(&self, status: Option<u16>) {
        *self.shared.plan_status.lock().unwrap() = status;
    }

    /// Run `check` on the received inventory before each Complete succeeds.
    pub fn before_complete(&self, check: CompletionCheck) {
        *self.shared.check.lock().unwrap() = Some(Arc::new(check));
    }

    /// Check before each Complete that the received bytes equal the installed build.
    pub fn observe(&self, directory: BuildDirectory) {
        self.before_complete(Box::new(move |received| {
            let local = files::tree(&directory.wait());
            assert!(
                received == &local,
                "the received inventory differs from the installed build"
            );
            inventory::verify(received).expect("the receiver accepts the inventory");
        }));
    }

    /// A copy of everything that the receiver recorded.
    pub fn record(&self) -> Record {
        self.shared.state.lock().unwrap().record.clone()
    }

    /// The largest number of Blob requests that the receiver handled at once.
    pub fn maximum_blob_concurrency(&self) -> usize {
        self.shared.max_blobs.load(Ordering::SeqCst)
    }

    /// Release held requests, stop the server, and fail with the first handler failure.
    pub fn close(mut self) {
        self.stop();
        if let Some(failure) = self.shared.failure.lock().unwrap().take() {
            panic!("the receiver failed a request: {failure}");
        }
    }

    fn stop(&mut self) {
        let (released, changed) = &self.shared.released;
        *released.lock().unwrap() = true;
        changed.notify_all();
        self.server.take();
    }
}

impl Drop for Exchange {
    fn drop(&mut self) {
        self.stop();
    }
}

fn answer(shared: &Shared, request: Request) -> Response {
    let blob = request.target.starts_with("/blobs/");
    if blob {
        let active = shared.active_blobs.fetch_add(1, Ordering::SeqCst) + 1;
        shared.max_blobs.fetch_max(active, Ordering::SeqCst);
    }
    let result = panic::catch_unwind(AssertUnwindSafe(|| routes::route(shared, &request)));
    if blob {
        shared.active_blobs.fetch_sub(1, Ordering::SeqCst);
    }
    result.unwrap_or_else(|failure| {
        let message = failure
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| {
                failure
                    .downcast_ref::<&str>()
                    .map(|text| (*text).to_owned())
            })
            .unwrap_or_else(|| "a handler panicked".to_owned());
        shared.failure.lock().unwrap().get_or_insert(message);
        Response::empty(500, &[])
    })
}
