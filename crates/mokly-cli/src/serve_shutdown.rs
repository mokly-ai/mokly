//! Serve cancels native jobs and drains the shared pool once for every stop source.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_cli::cancellation::Cancellation;
use mokly_graph::error;
use mokly_graph::error::GraphError;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_sidecar::pool::SidecarPool;
use tokio::sync::watch;
use tokio::task::{JoinError, JoinHandle};

pub(super) fn start(
    mut stop: watch::Receiver<bool>,
    cancellation: Arc<dyn Cancellation>,
    pool: Arc<dyn SidecarPool>,
    serving: Arc<AtomicBool>,
) -> JoinHandle<Result<()>> {
    tokio::spawn(async move {
        while !*stop.borrow() {
            if stop.changed().await.is_err() {
                break;
            }
        }
        if serving.load(Ordering::SeqCst) {
            return Ok(());
        }
        cancellation.interrupt();
        pool_result(
            tokio::task::spawn_blocking(move || {
                let cancelled = pool.cancel_requests();
                let shutdown = pool.shutdown();
                cancelled.and(shutdown)
            })
            .await,
        )
    })
}

pub(super) fn pool_result(
    result: std::result::Result<mokly_sidecar::error::Result<()>, JoinError>,
) -> Result<()> {
    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(source)) => Err(ServerError::Render {
            source: match source.diagnostic() {
                Some(source) => GraphError::Runtime { source },
                None => GraphError::Internal(error::InternalError::Provider {
                    source: Box::new(source),
                }),
            },
        }),
        Err(source) => Err(InternalError::Task { source }.into()),
    }
}

pub(super) fn finish(result: std::result::Result<Result<()>, JoinError>) -> Result<()> {
    match result {
        Ok(result) => result,
        Err(source) => Err(InternalError::Task { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/serve_shutdown_tests.rs"]
mod serve_shutdown_tests;
