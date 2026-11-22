//! Plan fixtures record the first full bundle response without retaining its generation.

use std::sync::Mutex;

use mokly_sidecar::compiled::UncapturedEvidence;
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::{BundleCapture, Call};
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::wire::MethodResult;

use super::support::CapturedPool;

/// The actual evidence and plan prerequisites of the fixture's first full capture.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct InitialCapture {
    /// Physical resolution inputs cover the compilation.
    pub(super) complete: bool,
    /// Capture witnesses permit plan retention and disk storage.
    pub(super) durable: bool,
    /// An explicit capture omission, when the sidecar reports one.
    pub(super) uncaptured: Option<UncapturedEvidence>,
    /// The sidecar returned a native resolution plan.
    pub(super) plan: bool,
    /// The compilation records its toolchain identity.
    pub(super) toolchain: bool,
}

/// Local plan-test capture preserves the real pool and its recorded requests.
pub(super) struct PlanPool {
    pub(super) inner: CapturedPool,
    initial: Mutex<Option<InitialCapture>>,
}

impl PlanPool {
    /// Observe responses from the same pool that records the test's requests.
    pub(super) fn new(inner: CapturedPool) -> Self {
        Self {
            inner,
            initial: Mutex::new(None),
        }
    }

    /// Report the evidence flags from the first full bundle response.
    pub(super) fn initial_capture(&self) -> Option<InitialCapture> {
        *self.initial.lock().unwrap()
    }

    /// Read the same last bundle request that the plan assertions inspect.
    pub(super) fn sent_plan(&self) -> bool {
        self.inner
            .calls
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find_map(|call| match call {
                Call::Bundle(request) => Some(request.plan.is_some()),
                _ => None,
            })
            .unwrap()
    }
}

impl SidecarPool for PlanPool {
    fn request(&self, call: Call) -> Result<MethodResult> {
        let full = matches!(&call, Call::Bundle(request)
            if request.capture.unwrap_or_default() == BundleCapture::Full);
        let result = self.inner.request(call)?;
        if full && let MethodResult::Bundle(bundle) = &result {
            let mut initial = self.initial.lock().unwrap();
            initial.get_or_insert_with(|| {
                let evidence = &bundle.compiled.reuse_evidence;
                InitialCapture {
                    complete: evidence.complete,
                    durable: evidence.durable,
                    uncaptured: evidence.uncaptured,
                    plan: bundle.plan.is_some(),
                    toolchain: !bundle.compiled.toolchain.is_empty(),
                }
            });
        }
        Ok(result)
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
    fn shutdown(&self) -> Result<()> {
        self.inner.shutdown()
    }
    fn abort(&self) -> Result<()> {
        self.inner.abort()
    }
}
