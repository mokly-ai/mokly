//! Serve cancels native jobs and drains the shared pool once for every stop source.

use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use mokly_graph::error;
use mokly_graph::error::GraphError;
use mokly_server::error::{InternalError, Result, ServerError};
use mokly_server::shutdown::Lifecycle;
use tokio::sync::watch;
use tokio::task::{JoinError, JoinHandle};

#[repr(u8)]
enum Stage {
    Starting = 0,
    Serving = 1,
    Stopping = 2,
}

/// Atomic startup handoff: a stop that wins cannot publish readiness.
#[derive(Default)]
pub(super) struct Phase {
    state: AtomicU8,
    readiness: Mutex<()>,
}
impl Phase {
    pub(super) fn starting(&self) -> bool {
        self.state.load(Ordering::SeqCst) == Stage::Starting as u8
    }
    pub(super) fn serve(&self, publish: &dyn Fn()) -> bool {
        let _readiness = self
            .readiness
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if self
            .state
            .compare_exchange(
                Stage::Starting as u8,
                Stage::Serving as u8,
                Ordering::SeqCst,
                Ordering::SeqCst,
            )
            .is_err()
        {
            return false;
        }
        publish();
        true
    }
    fn stop(&self) -> bool {
        let _readiness = self
            .readiness
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        self.state.swap(Stage::Stopping as u8, Ordering::SeqCst) == Stage::Starting as u8
    }
}

pub(super) fn start(
    mut stop: watch::Receiver<bool>,
    lifecycle: Arc<dyn Lifecycle>,
    phase: Arc<Phase>,
) -> JoinHandle<Result<()>> {
    tokio::spawn(async move {
        while !*stop.borrow() {
            if stop.changed().await.is_err() {
                break;
            }
        }
        if !phase.stop() {
            return Ok(());
        }
        let mut failure = None;
        for result in [
            lifecycle.stop_watcher().await,
            lifecycle.cancel_renders().await,
            lifecycle.cancel_git().await,
            lifecycle.shutdown_sidecars().await,
            lifecycle.release().await,
        ] {
            if let Err(error) = result {
                failure.get_or_insert(error);
            }
        }
        failure.map_or(Ok(()), Err)
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
