//! In-process polling whose lifetime is owned by the serving application future.

use std::future::{self, Future};
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use crate::github_worker::worker::DeliveryWorker;

pub(crate) trait WorkerLoop: Send + Sync {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}

pub(crate) struct GitHubWorkerLoop {
    pub(crate) worker: Option<Arc<dyn DeliveryWorker>>,
    pub(crate) interval: Duration,
}

impl WorkerLoop for GitHubWorkerLoop {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            let Some(worker) = &self.worker else {
                return future::pending().await;
            };
            loop {
                let worker = worker.clone();
                match tokio::task::spawn_blocking(move || worker.run_once()).await {
                    Ok(Ok(true)) => continue,
                    Ok(Ok(false)) => {}
                    Ok(Err(error)) => tracing::error!(?error, "GitHub delivery worker failed"),
                    Err(error) => tracing::error!(?error, "GitHub delivery worker task failed"),
                }
                tokio::time::sleep(self.interval).await;
            }
        })
    }
}
