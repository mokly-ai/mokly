//! Five-second provider delivery batches owned by the serving application future.

use std::future::{self, Future};
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use mkc_publications::build_check_worker::BuildChecksWorker;
use mkc_publications::check_rerequests::CheckRerequests;
use mkc_publications::check_worker::ChecksWorker;

use crate::github_runtime::WorkerLoop;

/// One iteration's independent publication, build and rerequest batches.
#[unimock::unimock(api = CheckDeliveryMock)]
pub(crate) trait CheckDelivery: Send + Sync {
    fn run_once(&self);
}

pub(crate) struct CheckBatches {
    pub(crate) publications: Arc<dyn ChecksWorker>,
    pub(crate) rerequests: Arc<dyn CheckRerequests>,
    pub(crate) builds: Arc<dyn BuildChecksWorker>,
    pub(crate) build_rerequests: Arc<dyn CheckRerequests>,
}

impl CheckDelivery for CheckBatches {
    fn run_once(&self) {
        if let Err(error) = self.publications.run_batch(None) {
            tracing::error!(?error, "publication check batch failed");
        }
        if let Err(error) = self.builds.run_batch(None) {
            tracing::error!(?error, "build check batch failed");
        }
        if let Err(error) = self.build_rerequests.run_batch() {
            tracing::error!(?error, "build check rerequest batch failed");
        }
        if let Err(error) = self.rerequests.run_batch() {
            tracing::error!(?error, "publication check rerequest batch failed");
        }
    }
}

#[unimock::unimock(api = CheckClockMock)]
pub(crate) trait CheckClock: Send + Sync {
    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

pub(crate) struct TokioCheckClock;

impl CheckClock for TokioCheckClock {
    fn sleep(&self, duration: Duration) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(tokio::time::sleep(duration))
    }
}

pub(crate) struct CheckWorkerLoop {
    pub(crate) worker: Option<Arc<dyn CheckDelivery>>,
    pub(crate) clock: Arc<dyn CheckClock>,
}

impl WorkerLoop for CheckWorkerLoop {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            let Some(worker) = &self.worker else {
                return future::pending().await;
            };
            loop {
                let worker = worker.clone();
                if let Err(error) = tokio::task::spawn_blocking(move || worker.run_once()).await {
                    tracing::error!(?error, "check delivery worker task failed");
                }
                self.clock.sleep(Duration::from_secs(5)).await;
            }
        })
    }
}

#[cfg(test)]
#[path = "_tests_/check_runtime_tests.rs"]
mod tests;
