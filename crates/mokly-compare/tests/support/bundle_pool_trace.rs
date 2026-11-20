//! Observation-only delegates retain real store and worker outcomes in failure logs.

use std::sync::Arc;

use mokly_sidecar::bundle_store::{BundleStore, ReadOutcome, RecordToken, WriteOutcome};
use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::error::Result;
use mokly_sidecar::methods::{Bundle, Call};
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::wire::{MethodResult, Request};
use mokly_sidecar::workers::{SpawnFailure, Spawned, Worker, WorkerFactory};

/// Log actual operations while leaving each real disk-store result unchanged.
pub(super) struct TraceStore {
    inner: Arc<dyn BundleStore>,
}

impl TraceStore {
    /// Retain the real disk store used by the pool.
    pub(super) fn new(inner: Arc<dyn BundleStore>) -> Self {
        Self { inner }
    }
}

impl BundleStore for TraceStore {
    fn load(&self, params: &Bundle) -> ReadOutcome {
        let outcome = self.inner.load(params);
        let details = match &outcome {
            ReadOutcome::Hit {
                recipe,
                token,
                maintenance,
            } => format!(
                "Hit runtime={}, token={}, maintenance={maintenance:?}",
                recipe.compiled().runtime_key,
                token.hex()
            ),
            ReadOutcome::Miss(reason) => format!("Miss({reason:?})"),
            ReadOutcome::Rejected { fault, retirement } => {
                format!("Rejected fault={fault:?}, retirement={retirement:?}")
            }
        };
        eprintln!(
            "bundle store load source={}: {details}, effects={:?}",
            params.source_root,
            outcome.effects()
        );
        outcome
    }

    fn save(&self, recipe: &DurableRecipe) -> WriteOutcome {
        let outcome = self.inner.save(recipe);
        eprintln!(
            "bundle store save source={}, runtime={}: outcome={outcome:?}, effects={:?}",
            recipe.params().source_root,
            recipe.compiled().runtime_key,
            outcome.effects()
        );
        outcome
    }

    fn invalidate(&self, params: &Bundle, token: &RecordToken) -> WriteOutcome {
        let outcome = self.inner.invalidate(params, token);
        eprintln!(
            "bundle store invalidate source={}, token={}: outcome={outcome:?}, effects={:?}",
            params.source_root,
            token.hex(),
            outcome.effects()
        );
        outcome
    }
}

/// Observe launch settings and restore results without replacing the real worker.
pub(super) struct TraceFactory {
    inner: Arc<dyn WorkerFactory>,
}

impl TraceFactory {
    /// Retain the real Node process factory.
    pub(super) fn new(inner: Arc<dyn WorkerFactory>) -> Self {
        Self { inner }
    }
}

impl WorkerFactory for TraceFactory {
    fn spawn(&self, launch: &Launch) -> std::result::Result<Spawned, SpawnFailure> {
        eprintln!(
            "bundle worker launch source={}, capture_durability={}",
            launch.repository.display(),
            launch.capture_durability
        );
        let mut spawned = self.inner.spawn(launch)?;
        spawned.worker = Box::new(TraceWorker {
            inner: spawned.worker,
        });
        Ok(spawned)
    }
}

struct TraceWorker {
    inner: Box<dyn Worker>,
}

impl Worker for TraceWorker {
    fn handshake(&mut self, deadline_ms: u64) -> Result<()> {
        self.inner.handshake(deadline_ms)
    }

    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult> {
        let result = self.inner.request(request, deadline_ms);
        if let Call::RestoreGeneration(restore) = &request.call {
            eprintln!(
                "bundle worker restore source={}, generation={}, runtime={}: outcome={:?}",
                restore.params.source_root,
                restore.generation,
                restore.compiled.runtime_key,
                result.as_ref().map(|_| ())
            );
        }
        result
    }

    fn memory_pressure(&self) {
        self.inner.memory_pressure();
    }

    fn resident_bytes(&self) -> Result<u64> {
        self.inner.resident_bytes()
    }
}
