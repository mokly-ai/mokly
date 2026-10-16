//! Observe real process starts and hello calls without replacing the Node transport.

use mokly_sidecar::operations::Operation;
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, mpsc};
use std::time::Duration;

use mokly_sidecar::error::Result;
use mokly_sidecar::pool_options::Launch;
use mokly_sidecar::wire::{MethodResult, Request};
use mokly_sidecar::workers::{Spawned, Worker, WorkerFactory};

/// One counter per successfully started sidecar process, in start order.
#[derive(Default)]
pub(super) struct ProcessCounts {
    hellos: Mutex<Vec<usize>>,
    operations: Mutex<BTreeMap<(u32, Operation), usize>>,
    changed: Condvar,
    recycle: AtomicBool,
    hold: Mutex<Option<(mpsc::Sender<usize>, mpsc::Receiver<()>)>>,
}

impl ProcessCounts {
    pub(super) fn hold_next(&self) -> (mpsc::Receiver<usize>, mpsc::Sender<()>) {
        let (entered, observed) = mpsc::channel();
        let (release, released) = mpsc::channel();
        *self.hold.lock().unwrap() = Some((entered, released));
        (observed, release)
    }

    pub(super) fn recycle_next(&self) {
        self.recycle.store(true, Ordering::SeqCst);
    }

    pub(super) fn record(&self, operation: Operation, pid: u32) {
        *self
            .operations
            .lock()
            .unwrap()
            .entry((pid, operation))
            .or_default() += 1;
        self.changed.notify_all();
    }
    pub(super) fn count(&self, operation: Operation) -> usize {
        self.operations
            .lock()
            .unwrap()
            .iter()
            .filter(|((_, op), _)| *op == operation)
            .map(|(_, count)| count)
            .sum()
    }
    pub(super) fn wait_for(&self, operation: Operation, count: usize) {
        let records = self.operations.lock().unwrap();
        let (records, _) = self
            .changed
            .wait_timeout_while(records, Duration::from_secs(30), |records| {
                records
                    .iter()
                    .filter(|((_, op), _)| *op == operation)
                    .map(|(_, count)| count)
                    .sum::<usize>()
                    < count
            })
            .unwrap();
        assert_eq!(
            records
                .iter()
                .filter(|((_, op), _)| *op == operation)
                .map(|(_, count)| count)
                .sum::<usize>(),
            count
        );
    }

    /// Hello calls made through each real process worker.
    pub(super) fn hellos(&self) -> Vec<usize> {
        self.hellos.lock().unwrap().clone()
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
            let mut counts = self.counts.hellos.lock().unwrap();
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
    fn handshake(&mut self, deadline_ms: u64) -> Result<()> {
        self.counts.hellos.lock().unwrap()[self.index] += 1;
        self.inner.handshake(deadline_ms)
    }
    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult> {
        let hold = self.counts.hold.lock().unwrap().take();
        if let Some((entered, released)) = hold {
            entered.send(self.index).unwrap();
            let _ = released.recv();
        }
        self.inner.request(request, deadline_ms)
    }
    fn resident_bytes(&self) -> Result<u64> {
        if self.counts.recycle.swap(false, Ordering::SeqCst) {
            return Ok(1024 * 1024 * 1024 + 1);
        }
        self.inner.resident_bytes()
    }
}
