//! Capture real bundle results and compare a checked edit with a fresh native request.

use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use mokly_platform::processes::SystemProcessGroups;
use mokly_sidecar::bundle_store::{BundleStoreMock, ReadMiss, ReadOutcome, WriteOutcome};
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::Call;
use mokly_sidecar::operations::Operation;
use mokly_sidecar::pool::{Pool, SidecarPool};
use mokly_sidecar::pool_options::{Launch, PoolOptions};
use mokly_sidecar::process_clock::SystemClock;
use mokly_sidecar::process_factory::NodeFactory;
use mokly_sidecar::process_memory::SystemMemory;
use mokly_sidecar::results::Bundle;
use mokly_sidecar::wire::MethodResult;
use mokly_sidecar::workers::Diagnostics;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use super::plan_capture::PlanPool;
use super::support::{CapturedPool, package_version, workspace};

#[derive(Default)]
pub(super) struct Counts(pub(super) AtomicUsize);

impl Diagnostics for Counts {
    fn emit(&self, message: &str) {
        eprintln!("{message}");
    }
    fn operation(&self, operation: Operation, _: u32) {
        if operation == Operation::Esbuild {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }
}

pub(super) struct Results {
    pub(super) inner: Arc<PlanPool>,
    last: Mutex<Option<std::result::Result<Bundle, String>>>,
}

impl Results {
    pub(super) fn new(root: &Path, counts: Arc<Counts>) -> Self {
        Self::create(root, counts, true)
    }

    fn create(root: &Path, counts: Arc<Counts>, stored: bool) -> Self {
        let clock = Arc::new(SystemClock::new());
        let pool = Pool::new(
            Arc::new(NodeFactory::new(
                Arc::new(SystemProcessGroups),
                clock.clone(),
                counts,
                Arc::new(SystemMemory),
            )),
            clock,
            Launch {
                capture_durability: false,
                node: "node".into(),
                entry: workspace().join("packages/mokly/dist/sidecar.js"),
                repository: root.into(),
                version: package_version::read(),
            },
            PoolOptions {
                size: 1.try_into().unwrap(),
                timeout_ms: None,
            },
        );
        let pool = if stored {
            pool.with_bundle_store(Arc::new(Unimock::new((
                BundleStoreMock::load
                    .each_call(matching!(_))
                    .returns(ReadOutcome::Miss(ReadMiss::Absent)),
                BundleStoreMock::save
                    .each_call(matching!(_))
                    .returns(WriteOutcome::Written),
            ))))
        } else {
            pool
        };
        Self {
            inner: Arc::new(PlanPool::new(CapturedPool {
                calls: Mutex::new(vec![]),
                inner: Arc::new(pool),
            })),
            last: Mutex::new(None),
        }
    }

    pub(super) fn assert_native(&self, root: &Path) {
        let mut request = self
            .inner
            .inner
            .calls
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find_map(|call| match call {
                Call::Bundle(request) => Some(request.clone()),
                _ => None,
            })
            .unwrap();
        request.plan = None;
        let native = Self::create(root, Arc::new(Counts::default()), false);
        let _result = native.request(Call::Bundle(request));
        let expected = native
            .last
            .lock()
            .unwrap()
            .clone()
            .unwrap()
            .map(fingerprint);
        let actual = self.last.lock().unwrap().clone().unwrap().map(fingerprint);
        native.shutdown().unwrap();
        assert_eq!(
            actual, expected,
            "checked edit must equal fresh native-first"
        );
    }
}

fn fingerprint(bundle: Bundle) -> Value {
    let mut compiled = (*bundle.compiled).clone();
    compiled.code = compiled
        .code
        .replace(&compiled.runtime_key, "mokly:runtime");
    compiled.runtime_key = "mokly:runtime".into();
    compiled.identity = "fresh edit identity".into();
    compiled.css_modules.sort();
    serde_json::json!({
        "modules": bundle.modules,
        "unmapped": bundle.unmapped_dependency_directories,
        "compiled": compiled,
    })
}

impl SidecarPool for Results {
    fn request(&self, call: Call) -> Result<MethodResult> {
        let capture = matches!(call, Call::Bundle(_));
        let result = self.inner.request(call);
        if capture {
            *self.last.lock().unwrap() = Some(match &result {
                Ok(MethodResult::Bundle(bundle)) => Ok((**bundle).clone()),
                Ok(_) => panic!("bundle returned another method result"),
                Err(error) => Err(error.to_string()),
            });
        }
        result
    }
    fn served_generation(&self, generation: &str, epoch: u64) {
        self.inner.served_generation(generation, epoch);
    }
    fn release_generation(&self, generation: &str, epoch: u64) {
        self.inner.release_generation(generation, epoch);
    }
    fn release_context(&self, context: &str) {
        self.inner.release_context(context);
    }
    fn cancel_requests(&self) -> Result<()> {
        self.inner.cancel_requests()
    }
    fn abort(&self) -> Result<()> {
        self.inner.abort()
    }
    fn shutdown(&self) -> Result<()> {
        self.inner.shutdown()
    }
}
