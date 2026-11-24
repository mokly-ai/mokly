//! Connect application services to their configured adapters.

use std::sync::{Arc, Mutex};

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
use mkc_publications::build_scheduler::DatabaseBuildScheduler;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;

use crate::application::{ApiApplication, ConfiguredApplicationFactory};
use crate::billing::service::{BillingService, BillingServiceConfig, DatabaseBillingService};
use crate::builds::service::{BuildsApi, BuildsService};
use crate::dispatch::ApiDispatcher;
use crate::error::{ApiErrorResultExt, Result};
use crate::github_composition::{GitHubComposer, GitHubComposition};
use crate::health::{DatabaseHealth, HealthCheck, SystemHealthClock};
use crate::live::access::DatabaseSocketAccess;
use crate::live::handler::LiveComposition;
use crate::platform::initial_plan::PreviewWorkspacePlan;
use crate::platform::service::{Platform, PlatformService};
use crate::preview_seed::factory::{SeedComposer, SystemSeedComposer};
use crate::publishing::{PublishingFactory, SystemPublishingFactory};

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
                .map(|config| PreviewSignIn::new(&config.secret, config.email.clone())),
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

        let preview_seed = SystemSeedComposer.compose(
            auth.clone(),
            platform.clone(),
            &publishing,
            runtime.clone(),
        );
        Ok(ApiApplication {
            preview_seed,
            settings,
            origins,
            dispatcher: Arc::new(ApiDispatcher {
                builds,
                auth: auth.clone(),
                platform,
                health,
                github: integration.service,
                billing,
                access: publishing.access,
                viewer: publishing.viewer,
            }),
            github_worker: integration.worker,
            check_worker: integration.checks,
            build_worker: integration.build_worker,
            build_reconciler: integration.reconciler,
            billing_worker,
            seat_worker,
            upload: publishing.upload,
            live: LiveComposition {
                access: Arc::new(DatabaseSocketAccess {
                    auth,
                    store,
                    runtime,
                }),
                clock: self.live_clock.clone(),
                relay: self.live_relay.clone(),
            },
        })
    }
}
