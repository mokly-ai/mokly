//! Serve orders observer shutdown, busy-worker cancellation, and idle-worker shutdown.

use std::io;
use std::sync::{Arc, Mutex};
use std::thread;

use async_trait::async_trait;
use mokly_cli::cancellation::Cancellation;
use mokly_server::error::Result;
use mokly_server::shutdown::Lifecycle;
use mokly_server::work::parallelism;
use mokly_sidecar::pool::SidecarPool;
use tokio::runtime::{Builder, Runtime};
use tokio::sync::watch;
use tokio::task::JoinHandle;

use crate::serve_eager::EagerStarts;
use crate::serve_git::GitWork;
use crate::serve_progress::Progress;
use crate::serve_shutdown;
use crate::serve_watch::WatchInputs;

/// Construct the Serve runtime with the same capacity used by background work.
pub(super) fn runtime() -> io::Result<(u32, Runtime)> {
    let workers = parallelism(thread::available_parallelism().map_or(1, usize::from));
    let runtime = Builder::new_multi_thread()
        .worker_threads(workers as usize)
        .enable_all()
        .build()?;
    Ok((workers, runtime))
}

/// Start progress animation with a command-owned stop receiver.
pub(super) fn animate(progress: Arc<dyn Progress>, stop: watch::Receiver<bool>) -> JoinHandle<()> {
    tokio::spawn(async move { progress.animate(stop).await })
}

pub(super) struct ServeLifecycle {
    pub(super) eager: Option<Arc<dyn EagerStarts>>,
    pub(super) git: Arc<dyn GitWork>,
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
        let git = self.git.clone();
        match tokio::task::spawn_blocking(move || git.cancel()).await {
            Ok(()) => Ok(()),
            Err(source) => Err(mokly_server::error::InternalError::Task { source }.into()),
        }
    }
    async fn shutdown_sidecars(&self) -> Result<()> {
        let pool = self.pool.clone();
        serve_shutdown::pool_result(tokio::task::spawn_blocking(move || pool.shutdown()).await)
    }
    async fn release(&self) -> Result<()> {
        let Some(eager) = self.eager.clone() else {
            return Ok(());
        };
        match tokio::task::spawn_blocking(move || eager.discard()).await {
            Ok(()) => Ok(()),
            Err(source) => Err(mokly_server::error::InternalError::Task { source }.into()),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/serve_lifecycle_tests.rs"]
mod serve_lifecycle_tests;
