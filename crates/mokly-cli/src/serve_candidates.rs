//! Manual candidates drain within the shutdown hooks before the port is released.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use async_trait::async_trait;
use mokly_server::error::Result;
use mokly_server::shutdown::Lifecycle;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

pub(super) trait CandidateWork: Send + Sync {
    fn enter(&self) -> Option<OwnedSemaphorePermit>;
    fn active(&self) -> bool;
}

pub(super) struct ManualCandidates {
    slot: Arc<Semaphore>,
    closed: AtomicBool,
    lifecycle: Arc<dyn Lifecycle>,
}
impl ManualCandidates {
    pub(super) fn new(lifecycle: Arc<dyn Lifecycle>) -> Self {
        Self {
            slot: Arc::new(Semaphore::new(1)),
            closed: AtomicBool::new(false),
            lifecycle,
        }
    }
}
impl CandidateWork for ManualCandidates {
    fn enter(&self) -> Option<OwnedSemaphorePermit> {
        if !self.active() {
            return None;
        }
        self.slot.clone().try_acquire_owned().ok()
    }
    fn active(&self) -> bool {
        !self.closed.load(Ordering::SeqCst)
    }
}
#[async_trait]
impl Lifecycle for ManualCandidates {
    async fn stop_watcher(&self) -> Result<()> {
        self.closed.store(true, Ordering::SeqCst);
        self.lifecycle.stop_watcher().await
    }
    async fn cancel_renders(&self) -> Result<()> {
        let result = self.lifecycle.cancel_renders().await;
        let _candidate = self.slot.clone().acquire_owned().await;
        result
    }
    async fn cancel_git(&self) -> Result<()> {
        self.lifecycle.cancel_git().await
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        self.lifecycle.shutdown_sidecars().await
    }
    async fn release(&self) -> Result<()> {
        self.lifecycle.release().await
    }
}

#[cfg(test)]
#[path = "_tests_/serve_candidates_tests.rs"]
mod serve_candidates_tests;
