//! Serve orders observer shutdown, busy-worker cancellation, and idle-worker shutdown.

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use mokly_cli::cancellation::Cancellation;
use mokly_server::error::Result;
use mokly_server::shutdown::Lifecycle;
use mokly_sidecar::pool::SidecarPool;

use crate::serve_shutdown;
use crate::serve_watch::WatchInputs;

pub(super) struct ServeLifecycle {
    pub(super) watch: Mutex<Option<Arc<dyn WatchInputs>>>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) pool: Arc<dyn SidecarPool>,
}

#[async_trait]
impl Lifecycle for ServeLifecycle {
    async fn stop_watcher(&self) -> Result<()> {
        let watch = self
            .watch
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        match watch {
            Some(watch) => watch.stop().await,
            None => Ok(()),
        }
    }
    async fn cancel_renders(&self) -> Result<()> {
        self.cancellation.interrupt();
        let pool = self.pool.clone();
        serve_shutdown::pool_result(
            tokio::task::spawn_blocking(move || pool.cancel_requests()).await,
        )
    }
    async fn cancel_git(&self) -> Result<()> {
        Ok(())
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        let pool = self.pool.clone();
        serve_shutdown::pool_result(tokio::task::spawn_blocking(move || pool.shutdown()).await)
    }
    async fn release(&self) -> Result<()> {
        Ok(())
    }
}

#[cfg(test)]
#[path = "_tests_/serve_lifecycle_tests.rs"]
mod serve_lifecycle_tests;
