//! Observe real process starts and hello calls without replacing the Node transport.

use std::sync::{Arc, Mutex};

use mokly_sidecar::error::Result;
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::wire::{MethodResult, Request};
use mokly_sidecar::workers::{Spawned, Worker, WorkerFactory};

/// One counter per successfully started sidecar process, in start order.
#[derive(Default)]
pub(super) struct ProcessCounts(Mutex<Vec<usize>>);

impl ProcessCounts {
    /// Hello calls made through each real process worker.
    pub(super) fn hellos(&self) -> Vec<usize> {
        self.0.lock().unwrap().clone()
    }
}

/// Preserve the actual factory and attach a counter to each worker it starts.
pub(super) struct CountedFactory {
    /// The Node factory used by the integration consumer.
    pub(super) inner: Arc<dyn WorkerFactory>,
    /// Shared observations for this consumer's pool.
    pub(super) counts: Arc<ProcessCounts>,
}

impl WorkerFactory for CountedFactory {
    fn spawn(&self, launch: &Launch) -> Result<Spawned> {
        let spawned = self.inner.spawn(launch)?;
        let index = {
            let mut counts = self.counts.0.lock().unwrap();
            let index = counts.len();
            counts.push(0);
            index
        };
        Ok(Spawned {
            worker: Box::new(CountedWorker {
                inner: spawned.worker,
                counts: self.counts.clone(),
                index,
            }),
            control: spawned.control,
        })
    }
}

struct CountedWorker {
    inner: Box<dyn Worker>,
    counts: Arc<ProcessCounts>,
    index: usize,
}

impl Worker for CountedWorker {
    fn memory_pressure(&self) {
        self.inner.memory_pressure();
    }
    fn handshake(&mut self, deadline_ms: u64) -> Result<()> {
        self.counts.0.lock().unwrap()[self.index] += 1;
        self.inner.handshake(deadline_ms)
    }
    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult> {
        self.inner.request(request, deadline_ms)
    }
    fn resident_bytes(&self) -> Result<u64> {
        self.inner.resident_bytes()
    }
}
