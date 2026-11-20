//! In-process polling loops for billing deliveries and seat reconciliation.

use std::future::{self, Future};
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use mkc_billing::seats::worker::SeatReconciler;
use mkc_billing::worker::worker::BillingDeliveryWorker;

use crate::github_runtime::WorkerLoop;

pub(crate) struct BillingWorkerLoop {
    pub(crate) worker: Option<Arc<dyn BillingDeliveryWorker>>,
}

impl WorkerLoop for BillingWorkerLoop {
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
                    Ok(Err(error)) => tracing::error!(?error, "billing delivery worker failed"),
                    Err(error) => {
                        tracing::error!(?error, "billing delivery worker task failed");
                    }
                }
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        })
    }
}

pub(crate) struct SeatWorkerLoop {
    pub(crate) worker: Option<Arc<dyn SeatReconciler>>,
}

impl WorkerLoop for SeatWorkerLoop {
    fn run(&self) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
        Box::pin(async {
            let Some(worker) = &self.worker else {
                return future::pending().await;
            };
            loop {
                let worker = worker.clone();
                match tokio::task::spawn_blocking(move || worker.run_once()).await {
                    Ok(Ok(_)) => {}
                    Ok(Err(error)) => tracing::error!(?error, "billing seat worker failed"),
                    Err(error) => tracing::error!(?error, "billing seat worker task failed"),
                }
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        })
    }
}
