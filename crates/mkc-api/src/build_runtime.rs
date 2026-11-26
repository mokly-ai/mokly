//! Concurrent build claims at the claim interval and independent five-minute reconciliation.

use std::future::{self, Future};
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use mkc_publications::build_reconciliation::BuildReconciler;
use mkc_publications::build_worker::service::{BuildClaim, BuildWorker};
use tokio::task::JoinSet;

use crate::check_runtime::CheckClock;
use crate::github_runtime::WorkerLoop;

pub(crate) struct BuildWorkerLoop {
    pub(crate) worker: Option<Arc<dyn BuildWorker>>,
    pub(crate) clock: Arc<dyn CheckClock>,
    /// The pause after a claim that finds no build; production waits two seconds.
    pub(crate) interval: Duration,
}

impl WorkerLoop for BuildWorkerLoop {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            let Some(worker) = &self.worker else {
                return future::pending().await;
            };
            let mut attempts = JoinSet::new();
            loop {
                while let Some(result) = attempts.try_join_next() {
                    if let Err(error) = result {
                        tracing::error!(?error, "build execution task failed");
                    }
                }
                let claimant = worker.clone();
                match tokio::task::spawn_blocking(move || claimant.claim()).await {
                    Ok(Ok(BuildClaim::Attempt(attempt))) => {
                        let worker = worker.clone();
                        attempts.spawn(async move {
                            if let Err(error) = worker.execute(*attempt).await {
                                tracing::error!(?error, "build attempt failed");
                            }
                        });
                        continue;
                    }
                    Ok(Ok(BuildClaim::Handled)) => continue,
                    Ok(Ok(BuildClaim::Idle)) => {}
                    Ok(Err(error)) => tracing::error!(?error, "build claim failed"),
                    Err(error) => tracing::error!(?error, "build claim task failed"),
                }
                tokio::select! {
                    result = attempts.join_next(), if !attempts.is_empty() => {
                        if let Some(Err(error)) = result { tracing::error!(?error, "build execution task failed"); }
                    }
                    () = self.clock.sleep(self.interval) => {},
                }
            }
        })
    }
}

pub(crate) struct BuildReconciliationLoop {
    pub(crate) reconciler: Option<Arc<dyn BuildReconciler>>,
    pub(crate) clock: Arc<dyn CheckClock>,
}

impl WorkerLoop for BuildReconciliationLoop {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            let Some(reconciler) = &self.reconciler else {
                return future::pending().await;
            };
            loop {
                if let Err(error) = reconciler.reconcile().await {
                    tracing::error!(?error, "build sandbox reconciliation failed");
                }
                self.clock.sleep(Duration::from_secs(300)).await;
            }
        })
    }
}

#[cfg(test)]
#[path = "_tests_/build_runtime_tests.rs"]
mod tests;
