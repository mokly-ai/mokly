//! Database-only pruning and database/file-store publication cleanup commands.

use std::sync::Arc;
use std::time::Duration;

use mkc_api::error::{ApiErrorResultExt, Result};
use mkc_api::maintenance::factory::{
    PublicationMaintenanceFactory, SystemPublicationMaintenanceFactory,
};
use mkc_api::maintenance::github;
use mkc_auth::prune::{AuthPruner, Pruner, Retention};
use mkc_auth::runtime;
use mkc_config::maintenance::{
    GitHubRetentionConfig, MaintenanceConfig, PublicationMaintenanceConfig,
};
use mkc_config::settings::EnvironmentConfig;
use mkc_db::migration::{DieselMigrations, MigrationRunner};
use mkc_publications::build_maintenance::{BuildMaintenance, DatabaseBuildMaintenance};
use mkc_publications::transaction::StoreTransactions;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;

/// Native operator commands that do not load serving configuration.
pub(crate) trait MaintenanceRunner {
    /// Prune expired authentication records and finished builds.
    fn prune(&self) -> Result<()>;
    /// Prune expired OAuth flows and terminal webhook deliveries.
    fn prune_github(&self) -> Result<()>;
    /// Recover failed uploads and collect unreferenced file-store objects.
    fn maintain_publications(&self) -> Result<()>;
    /// Apply pending database migrations and exit.
    fn migrate(&self) -> Result<()>;
}

/// Production composition using the injected environment configuration.
pub(crate) struct SystemMaintenanceRunner {
    /// Shared environment boundary for each command's limited settings.
    pub(crate) config: EnvironmentConfig,
}

impl MaintenanceRunner for SystemMaintenanceRunner {
    fn prune(&self) -> Result<()> {
        let settings = self
            .config
            .maintenance()
            .context("load authentication retention settings")?;
        let factory: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        };
        let store = factory
            .connect(&settings.database_url)
            .context("connect pruning store")?;
        let pruner: &dyn Pruner = &AuthPruner {
            store: store.clone(),
            runtime: Arc::new(runtime::SystemRuntime),
            retention: Retention {
                links: Duration::from_secs(u64::from(settings.link_seconds)),
                sessions: Duration::from_secs(u64::from(settings.session_seconds)),
                rate_limits: Duration::from_secs(u64::from(settings.rate_seconds)),
            },
        };
        let report = pruner.prune().context("prune authentication records")?;
        tracing::info!(
            links = report.links,
            sessions = report.sessions,
            rate_limits = report.rate_limits,
            "authentication records pruned"
        );
        let builds: &dyn BuildMaintenance = &DatabaseBuildMaintenance {
            transactions: Arc::new(StoreTransactions { store }),
            runtime: Arc::new(runtime::SystemRuntime),
        };
        let builds = builds
            .prune(settings.build_seconds)
            .context("prune finished builds")?;
        tracing::info!(builds, "build records pruned");
        Ok(())
    }

    fn prune_github(&self) -> Result<()> {
        let settings = self
            .config
            .github_retention()
            .context("load GitHub retention settings")?;
        let factory: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        };
        let pruner: &dyn github::GitHubPruner = &github::GitHubPrune {
            store: factory
                .connect(&settings.database_url)
                .context("connect GitHub pruning store")?,
            runtime: Arc::new(runtime::SystemRuntime),
            retention: github::Retention {
                oauth_flows: Duration::from_secs(u64::from(settings.oauth_seconds)),
                deliveries: Duration::from_secs(u64::from(settings.delivery_seconds)),
            },
        };
        let report = pruner.prune().context("prune GitHub records")?;
        tracing::info!(
            oauth_flows = report.oauth_flows,
            deliveries = report.deliveries,
            "GitHub records pruned"
        );
        Ok(())
    }

    fn maintain_publications(&self) -> Result<()> {
        let settings = self
            .config
            .publication_maintenance()
            .context("load publication maintenance settings")?;
        let factory: &dyn PublicationMaintenanceFactory = &SystemPublicationMaintenanceFactory;
        let report = factory
            .create(&settings)?
            .run()
            .context("maintain publications and objects")?;
        tracing::info!(
            abandoned = report.abandoned,
            pruned = report.pruned,
            blobs = report.blobs,
            orphans = report.orphans,
            "publication maintenance complete"
        );
        Ok(())
    }

    fn migrate(&self) -> Result<()> {
        let settings = self
            .config
            .maintenance()
            .context("load migration database")?;
        let runner: &dyn MigrationRunner = &DieselMigrations;
        runner
            .migrate(&settings.database_url)
            .context("migrate API database")
    }
}
