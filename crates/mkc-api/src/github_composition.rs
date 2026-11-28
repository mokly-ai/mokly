//! GitHub, check and optional build workers assembled only at startup.

use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_config::settings::Settings;
use mkc_publications::build_check_rerequests::BuildCheckRerequests;
use mkc_publications::build_check_worker::BuildCheckDelivery;
use mkc_publications::build_head::DatabaseBuildHeadRecorder;
use mkc_publications::build_reconciliation::{BuildReconciler, SandboxBuildReconciler};
use mkc_publications::build_scheduler::{BuildScheduler, DatabaseBuildScheduler};
use mkc_publications::build_worker::service::{
    BuildWorker, BuildWorkerConfig, BuildWorkerFactory, DatabaseBuildWorkerFactory,
    TokioBuildLeaseClock,
};
use mkc_publications::check_provider::GitHubCheckRuns;
use mkc_publications::check_rerequests::PublicationCheckRerequests;
use mkc_publications::check_worker::PublicationChecks;
use mkc_store_interface::store::Store;

use crate::build_providers::BuildProviderFactory;
use crate::builds::service::{BuildsApi, BuildsService};
use crate::check_runtime::{CheckBatches, CheckDelivery};
use crate::error::Result;
use crate::github::service::{GitHubIntegration, GitHubService, Navigation};
use crate::github_providers::GitHubProviderFactory;
use crate::github_worker::handlers::GitHubHandlers;
use crate::github_worker::worker::{DeliveryWorker, GitHubWorker};
use crate::publishing::Publishing;

#[derive(Default)]
pub(crate) struct GitHubServices {
    pub(crate) service: Option<Arc<dyn GitHubIntegration>>,
    pub(crate) worker: Option<Arc<dyn DeliveryWorker>>,
    pub(crate) checks: Option<Arc<dyn CheckDelivery>>,
    pub(crate) build_api: Option<Arc<dyn BuildsApi>>,
    pub(crate) build_worker: Option<Arc<dyn BuildWorker>>,
    pub(crate) reconciler: Option<Arc<dyn BuildReconciler>>,
}

pub(crate) trait GitHubComposer {
    fn create(&self, settings: &Settings, publishing: &Publishing) -> Result<GitHubServices>;
}

pub(crate) struct GitHubComposition {
    pub(crate) factory: Arc<dyn GitHubProviderFactory>,
    pub(crate) builds: Arc<dyn BuildProviderFactory>,
    pub(crate) store: Arc<dyn Store>,
    pub(crate) runtime: Arc<dyn Runtime>,
}

impl GitHubComposer for GitHubComposition {
    fn create(&self, settings: &Settings, publishing: &Publishing) -> Result<GitHubServices> {
        let Some(config) = &settings.github else {
            return Ok(GitHubServices::default());
        };
        let providers = self.factory.create(config, &settings.app_origin)?;
        let scheduler: Arc<dyn BuildScheduler> = Arc::new(DatabaseBuildScheduler {
            configured: settings.builds.is_some(),
        });
        let github = Arc::new(GitHubCheckRuns {
            store: self.store.clone(),
            checks: providers.checks,
            runtime: self.runtime.clone(),
            app_id: config.app_id,
        });
        let publications = Arc::new(PublicationChecks {
            transactions: publishing.transactions.clone(),
            files: publishing.indexes.clone(),
            github: github.clone(),
            runtime: self.runtime.clone(),
            locations: publishing.locations.clone(),
        });
        let mut result = GitHubServices {
            build_api: Some(Arc::new(BuildsService {
                head_recorder: Arc::new(DatabaseBuildHeadRecorder),
                store: self.store.clone(),
                runtime: self.runtime.clone(),
                scheduler: scheduler.clone(),
                repositories: Some(providers.repositories.clone()),
                pull_requests: Some(providers.pull_requests.clone()),
                locations: publishing.locations.clone(),
                configured: settings.builds.is_some(),
            })),
            ..GitHubServices::default()
        };
        if let Some(builds) = &settings.builds {
            let build_providers = self.builds.create(builds)?;
            let factory: &dyn BuildWorkerFactory = &DatabaseBuildWorkerFactory {
                transactions: publishing.transactions.clone(),
                runtime: self.runtime.clone(),
                credentials: providers.tokens.clone(),
                runner: build_providers.runner,
                clock: Arc::new(TokioBuildLeaseClock),
            };
            result.build_worker = Some(factory.create(BuildWorkerConfig {
                api_origin: settings.api_origin.clone(),
                per_process: builds.per_process,
            }));
            result.reconciler = Some(Arc::new(SandboxBuildReconciler {
                transactions: publishing.transactions.clone(),
                lifecycle: build_providers.sandbox.lifecycle,
                deployment_id: builds.deployment_id.clone(),
            }));
        }
        result.checks = Some(Arc::new(CheckBatches {
            builds: Arc::new(BuildCheckDelivery {
                transactions: publishing.transactions.clone(),
                github,
                publications: publications.clone(),
                runtime: self.runtime.clone(),
                locations: publishing.locations.clone(),
            }),
            build_rerequests: Arc::new(BuildCheckRerequests {
                store: self.store.clone(),
                scheduler: scheduler.clone(),
                runtime: self.runtime.clone(),
            }),
            publications,
            rerequests: Arc::new(PublicationCheckRerequests {
                store: self.store.clone(),
                runtime: self.runtime.clone(),
            }),
        }));
        result.service = Some(Arc::new(GitHubService {
            store: self.store.clone(),
            runtime: self.runtime.clone(),
            identities: providers.identities,
            repositories: providers.repositories.clone(),
            tokens: providers.tokens.clone(),
            verifier: providers.verifier,
            navigation: Navigation {
                app_origin: settings.app_origin.clone(),
                web_origin: config.web_origin.clone(),
                client_id: config.client_id.clone(),
                app_slug: config.app_slug.clone(),
                app_id: config.app_id,
            },
        }));
        result.worker = Some(Arc::new(GitHubWorker {
            store: self.store.clone(),
            runtime: self.runtime.clone(),
            handler: Arc::new(GitHubHandlers {
                head_recorder: Arc::new(DatabaseBuildHeadRecorder),
                store: self.store.clone(),
                runtime: self.runtime.clone(),
                repositories: providers.repositories,
                pull_requests: providers.pull_requests,
                tokens: providers.tokens,
                app_id: config.app_id,
                build_scheduler: settings.builds.as_ref().map(|_| scheduler),
            }),
        }));
        Ok(result)
    }
}
