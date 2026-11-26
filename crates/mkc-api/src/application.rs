//! Composition-root factory and trait-backed API server.

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_auth::service::{AuthService, Authenticator, PreviewSignIn};
use mkc_billing::entitlements::DatabaseEntitlements;
use mkc_billing::lifecycle::{BillingLifecycle, SubscriptionLifecycle};
use mkc_billing::prices::{PriceVerifier, ProviderPriceVerifier};
use mkc_billing::seats::worker::{DatabaseSeatReconciler, SeatReconciler};
use mkc_billing::worker::worker::{BillingDeliveryWorker, DatabaseBillingDeliveryWorker};
use mkc_config::settings::{Mail, Settings};
use mkc_db::migration::{
    DieselMigrations, MigrationRunner, MigrationStatusFactory, PooledMigrationStatusFactory,
};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_email_interface::mail::Mailer;
use mkc_email_postmark::delivery::{LogMailer, PostmarkMailer};
use mkc_email_postmark::transport::{PostmarkHttpFactory, TransportFactory};
use mkc_publications::build_head::DatabaseBuildHeadRecorder;
use mkc_publications::build_reconciliation::BuildReconciler;
use mkc_publications::build_scheduler::DatabaseBuildScheduler;
use mkc_publications::build_worker::service::BuildWorker;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;
use tokio::net::TcpListener;

use crate::billing::service::{BillingService, BillingServiceConfig, DatabaseBillingService};
use crate::billing_providers::{BillingProviderFactory, SystemBillingProviderFactory};
use crate::build_providers::{BuildProviderFactory, SystemBuildProviderFactory};
use crate::builds::service::{BuildsApi, BuildsService};
use crate::check_runtime::CheckDelivery;
use crate::dispatch::{ApiDispatcher, Dispatcher};
use crate::error::{ApiErrorResultExt, Result};
use crate::github_composition::{GitHubComposer, GitHubComposition};
use crate::github_providers::{GitHubProviderFactory, SystemGitHubProviderFactory};
use crate::github_worker::worker::DeliveryWorker;
use crate::health::{DatabaseHealth, HealthCheck, SystemHealthClock};
use crate::platform::initial_plan::PreviewWorkspacePlan;
use crate::platform::service::{Platform, PlatformService};
use crate::preview_seed::factory::{SeedComposer, SystemSeedComposer};
use crate::preview_seed::service::PreviewSeeder;
use crate::publishing::{PublishingFactory, SystemPublishingFactory};
use crate::upload::UploadHandler;
use crate::worker_intervals::WorkerIntervals;

/// Running API behavior, independent of concrete wiring.
pub trait Application: Send + Sync {
    /// Bind and serve until shutdown; reports its actual socket through tracing.
    fn serve(&self) -> Pin<Box<dyn Future<Output = Result<()>> + Send + '_>>;

    /// Serve a caller-bound listener with the same router and worker lifetimes.
    fn serve_on(
        &self,
        listener: TcpListener,
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
    /// Worker loop pauses; production uses the defaults.
    pub intervals: WorkerIntervals,
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
    pub(crate) intervals: WorkerIntervals,
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
            intervals: WorkerIntervals::default(),
        }
    }
}

impl ApplicationFactory for ConfiguredApplicationFactory {
    fn create(&self, settings: Settings) -> Result<Arc<dyn Application>> {
        Ok(Arc::new(self.compose(settings)?))
    }
}

impl ConfiguredApplicationFactory {
    pub(crate) fn compose(&self, settings: Settings) -> Result<ApiApplication> {
        let migrations: Arc<dyn MigrationRunner> = Arc::new(DieselMigrations);
        migrations
            .migrate(&settings.database_url)
            .context("migrate platform database")?;
        let factory: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(runtime::SystemRuntime),
        };
        let store = factory.connect(&settings.database_url)?;
        let runtime = self.runtime.clone();
        let mailer: Arc<dyn Mailer> = match &settings.mail {
            Mail::Log => Arc::new(LogMailer),
            Mail::Postmark {
                from,
                token,
                site_origin,
            } => Arc::new(PostmarkMailer {
                from: from.clone(),
                site_origin: site_origin.clone(),
                transport: PostmarkHttpFactory
                    .build(
                        "https://api.postmarkapp.com/email/withTemplate".to_owned(),
                        token.clone(),
                    )
                    .context("initialize Postmark transport")?,
            }),
        };
        let origins = AdmittedOrigins::new(settings.app_origin.clone(), settings.desktop_client);
        let auth: Arc<dyn Authenticator> = Arc::new(AuthService {
            store: store.clone(),
            runtime: runtime.clone(),
            mailer: mailer.clone(),
            origins: origins.clone(),
            preview_sign_in: settings
                .preview_sign_in
                .as_ref()
                .map(|config| PreviewSignIn::new(config.email.clone(), config.verifier.clone())),
        });
        let publishing = SystemPublishingFactory.create(
            &settings.publications,
            &settings.app_origin,
            &settings.api_origin,
            store.clone(),
            runtime.clone(),
        )?;
        let mut billing = None;
        let mut billing_worker = None;
        let mut seat_worker = None;
        let mut billing_provider = None;
        if let Some(config) = &settings.billing {
            let providers = self.billing.create(config)?;
            let prices = Arc::new(
                ProviderPriceVerifier {
                    provider: providers.price_provider,
                }
                .verify(),
            );
            billing_provider = Some(providers.provider.clone());
            billing = Some(Arc::new(DatabaseBillingService::new(
                store.clone(),
                runtime.clone(),
                providers.provider.clone(),
                providers.verifier,
                prices.clone(),
                BillingServiceConfig {
                    app_origin: settings.app_origin.clone(),
                },
            )) as Arc<dyn BillingService>);
            billing_worker = Some(Arc::new(DatabaseBillingDeliveryWorker::new(
                store.clone(),
                runtime.clone(),
                providers.provider.clone(),
                prices.identities(),
            )) as Arc<dyn BillingDeliveryWorker>);
            if let Some(price_ids) = prices.identities() {
                seat_worker = Some(Arc::new(DatabaseSeatReconciler::new(
                    store.clone(),
                    runtime.clone(),
                    providers.provider,
                    price_ids,
                )) as Arc<dyn SeatReconciler>);
            }
        }
        let billing_lifecycle: Arc<dyn BillingLifecycle> = Arc::new(SubscriptionLifecycle {
            store: store.clone(),
            provider: billing_provider,
        });
        let readiness: &dyn MigrationStatusFactory = &PooledMigrationStatusFactory;
        let health: Arc<dyn HealthCheck> = Arc::new(DatabaseHealth {
            migrations: readiness
                .connect(&settings.database_url)
                .context("connect readiness")?,
            clock: Arc::new(SystemHealthClock),
            cache: Mutex::new(None),
        });
        health.check()?;
        let composer: &dyn GitHubComposer = &GitHubComposition {
            factory: self.github.clone(),
            builds: self.builds.clone(),
            store: store.clone(),
            runtime: runtime.clone(),
        };
        let integration = composer.create(&settings, &publishing)?;
        let builds: Arc<dyn BuildsApi> = integration.build_api.unwrap_or_else(|| {
            Arc::new(BuildsService {
                head_recorder: Arc::new(DatabaseBuildHeadRecorder),
                store: store.clone(),
                runtime: runtime.clone(),
                scheduler: Arc::new(DatabaseBuildScheduler { configured: false }),
                repositories: None,
                pull_requests: None,
                locations: publishing.locations.clone(),
                configured: false,
            })
        });
        let platform: Arc<dyn Platform> = Arc::new(PlatformService {
            builds: builds.clone(),
            store: store.clone(),
            runtime: runtime.clone(),
            mailer,
            entitlements: Arc::new(DatabaseEntitlements),
            billing: billing_lifecycle,
            preview_workspace: settings.preview_sign_in.as_ref().map(|config| {
                PreviewWorkspacePlan {
                    email: config.email.clone(),
                    plan: config.plan,
                }
            }),
            app_origin: settings.app_origin.clone(),
        });

        let preview_seed =
            SystemSeedComposer.compose(auth.clone(), platform.clone(), &publishing, runtime);
        Ok(ApiApplication {
            preview_seed,
            settings,
            origins,
            dispatcher: Arc::new(ApiDispatcher {
                builds,
                auth,
                platform,
                health,
                github: integration.service,
                billing,
                access: publishing.access,
                viewer: publishing.viewer,
                preview_hash_slots: Default::default(),
            }),
            github_worker: integration.worker,
            check_worker: integration.checks,
            build_worker: integration.build_worker,
            build_reconciler: integration.reconciler,
            billing_worker,
            seat_worker,
            upload: publishing.upload,
            intervals: self.intervals,
        })
    }
}
