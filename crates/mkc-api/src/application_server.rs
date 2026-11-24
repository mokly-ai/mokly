//! API serving and worker lifetimes after composition completes.

use std::future::{Future, IntoFuture};
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;

use axum::Router;
use tokio::net::TcpListener;

use crate::application::{ApiApplication, Application};
use crate::application_shutdown::shutdown_signal;
use crate::billing_runtime::{BillingWorkerLoop, SeatWorkerLoop};
use crate::build_runtime::{BuildReconciliationLoop, BuildWorkerLoop};
use crate::check_runtime::{CheckWorkerLoop, TokioCheckClock};
use crate::error::{ApiErrorResultExt, Result};
use crate::github_runtime::{GitHubWorkerLoop, WorkerLoop};
use crate::live::handler::{LiveHandler, LiveServer};
use crate::router::{RouterBuilder, RouterFactory};

impl Application for ApiApplication {
    fn serve(&self) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>> {
        Box::pin(async {
            let live = self.live.start(&self.settings.database_url).await?;
            let router = self.build_router(live.clone())?;
            let listener = TcpListener::bind(self.settings.bind)
                .await
                .context("bind API listener")?;
            self.serve_router(listener, router, live, Box::pin(shutdown_signal()))
                .await
        })
    }

    fn serve_on(
        &self,
        listener: TcpListener,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>> {
        self.serve_on_until(listener, Box::pin(shutdown_signal()))
    }

    fn serve_on_until(
        &self,
        listener: TcpListener,
        shutdown: Pin<Box<dyn Future<Output = ()> + Send>>,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>> {
        Box::pin(async move {
            let live = self.live.start(&self.settings.database_url).await?;
            let router = self.build_router(live.clone())?;
            self.serve_router(listener, router, live, shutdown).await
        })
    }
}

impl ApiApplication {
    fn build_router(&self, live: Arc<dyn LiveHandler>) -> Result<Router> {
        let builder: &dyn RouterBuilder = &RouterFactory {
            trusted_proxies: self.settings.trusted_proxies.clone(),
            dispatcher: self.dispatcher.clone(),
            upload: self.upload.clone(),
            live,
            origins: self.origins.clone(),
            billing_configured: self.settings.billing.is_some(),
        };
        builder.build()
    }

    async fn serve_router(
        &self,
        listener: TcpListener,
        router: Router,
        live: Arc<LiveServer>,
        shutdown: Pin<Box<dyn Future<Output = ()> + Send>>,
    ) -> Result<()> {
        tracing::info!(address = %listener.local_addr().context("read listener address")?, "API listening");
        let live_on_shutdown = live.clone();
        let server = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            shutdown.await;
            live_on_shutdown.shutdown();
        });
        let worker = GitHubWorkerLoop {
            worker: self.github_worker.clone(),
        };
        let worker: &dyn WorkerLoop = &worker;
        let billing_worker = BillingWorkerLoop {
            worker: self.billing_worker.clone(),
        };
        let billing_worker: &dyn WorkerLoop = &billing_worker;
        let seat_worker = SeatWorkerLoop {
            worker: self.seat_worker.clone(),
        };
        let seat_worker: &dyn WorkerLoop = &seat_worker;
        let check_worker = CheckWorkerLoop {
            worker: self.check_worker.clone(),
            clock: Arc::new(TokioCheckClock),
        };
        let check_worker: &dyn WorkerLoop = &check_worker;
        let builds = BuildWorkerLoop {
            worker: self.build_worker.clone(),
            clock: Arc::new(TokioCheckClock),
        };
        let builds: &dyn WorkerLoop = &builds;
        let reconciliation = BuildReconciliationLoop {
            reconciler: self.build_reconciler.clone(),
            clock: Arc::new(TokioCheckClock),
        };
        let reconciliation: &dyn WorkerLoop = &reconciliation;
        let result = tokio::select! {
            result = server.into_future() => result.context("serve API"),
            () = worker.run() => Ok(()),
            () = builds.run() => Ok(()),
            () = reconciliation.run() => Ok(()),
            () = check_worker.run() => Ok(()),
            () = billing_worker.run() => Ok(()),
            () = seat_worker.run() => Ok(()),
        };
        live.shutdown();
        live.wait().await;
        result
    }
}
