//! Application entry points and dependency injection for the API.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_billing::seats::worker::SeatReconciler;
use mkc_billing::worker::worker::BillingDeliveryWorker;
use mkc_config::settings::Settings;
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_live::memory::MemoryRelay;
use mkc_live_interface::relay::LiveRelay;
use mkc_publications::build_reconciliation::BuildReconciler;
use mkc_publications::build_worker::service::BuildWorker;
use tokio::net::TcpListener;

use crate::billing_providers::{BillingProviderFactory, SystemBillingProviderFactory};
use crate::build_providers::{BuildProviderFactory, SystemBuildProviderFactory};
use crate::check_runtime::CheckDelivery;
use crate::dispatch::Dispatcher;
use crate::error::Result;
use crate::github_providers::{GitHubProviderFactory, SystemGitHubProviderFactory};
use crate::github_worker::worker::DeliveryWorker;
use crate::live::handler::LiveComposition;
use crate::live_clock::{LiveClock, TokioLiveClock};
use crate::preview_seed::service::PreviewSeeder;
use crate::upload::UploadHandler;

/// Running API behavior, independent of concrete wiring.
pub trait Application: Send + Sync {
    /// Bind and serve until shutdown; reports its actual socket through tracing.
    fn serve(&self) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;

    /// Serve a caller-bound listener with the same router and worker lifetimes.
    fn serve_on(
        &self,
        listener: TcpListener,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;

    /// Serve a bound listener until the embedding caller requests shutdown.
    fn serve_on_until(
        &self,
        listener: TcpListener,
        shutdown: Pin<Box<dyn Future<Output = ()> + Send>>,
    ) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;
}

/// Composition boundary creating a fully configured application.
pub trait ApplicationFactory {
    /// Validate dependency connectivity and run migrations before serving.
    fn create(&self, settings: Settings) -> Result<Arc<dyn Application>>;
}

/// Production composition root; development changes only explicit configuration.
pub struct SystemApplicationFactory;

/// Application composition with an explicit provider factory for embedded use.
pub struct ConfiguredApplicationFactory {
    /// GitHub behavior factory; production uses the system implementation.
    pub github: Arc<dyn GitHubProviderFactory>,
    /// Billing behavior factory; production uses the system Stripe implementation.
    pub billing: Arc<dyn BillingProviderFactory>,
    /// Clock, identifiers and credentials shared by application services.
    pub runtime: Arc<dyn Runtime>,
    /// Build provider factory; tests inject a runner without E2B access.
    pub builds: Arc<dyn BuildProviderFactory>,
    /// Relay injected into the live hub when the application starts serving.
    pub live_relay: Arc<dyn LiveRelay + Send + Sync>,
    /// Monotonic clock for live socket deadlines.
    pub live_clock: Arc<dyn LiveClock>,
}

pub(crate) struct ApiApplication {
    pub(crate) preview_seed: Arc<dyn PreviewSeeder>,
    pub(crate) settings: Settings,
    pub(crate) origins: AdmittedOrigins,
    pub(crate) dispatcher: Arc<dyn Dispatcher>,
    pub(crate) check_worker: Option<Arc<dyn CheckDelivery>>,
    pub(crate) build_worker: Option<Arc<dyn BuildWorker>>,
    pub(crate) build_reconciler: Option<Arc<dyn BuildReconciler>>,
    pub(crate) github_worker: Option<Arc<dyn DeliveryWorker>>,
    pub(crate) billing_worker: Option<Arc<dyn BillingDeliveryWorker>>,
    pub(crate) seat_worker: Option<Arc<dyn SeatReconciler>>,
    pub(crate) upload: Arc<dyn UploadHandler>,
    pub(crate) live: LiveComposition,
}

impl ApplicationFactory for SystemApplicationFactory {
    fn create(&self, settings: Settings) -> Result<Arc<dyn Application>> {
        ConfiguredApplicationFactory::default().create(settings)
    }
}

impl Default for ConfiguredApplicationFactory {
    fn default() -> Self {
        Self {
            github: Arc::new(SystemGitHubProviderFactory),
            billing: Arc::new(SystemBillingProviderFactory),
            runtime: Arc::new(SystemRuntime),
            builds: Arc::new(SystemBuildProviderFactory),
            live_relay: Arc::new(MemoryRelay::default()),
            live_clock: Arc::new(TokioLiveClock),
        }
    }
}

impl ApplicationFactory for ConfiguredApplicationFactory {
    fn create(&self, settings: Settings) -> Result<Arc<dyn Application>> {
        Ok(Arc::new(self.compose(settings)?))
    }
}
