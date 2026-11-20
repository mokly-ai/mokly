//! Database-only publication, build and billing delivery recovery commands.

use std::sync::Arc;

use mkc_api::error::{ApiErrorResultExt, Result};
use mkc_auth::runtime;
use mkc_billing::recovery::{BillingRecovery, StoreBillingRecovery};
use mkc_config::settings::{self, Environment};
use mkc_domain::ids::BuildId;
use mkc_publications::build_maintenance::{BuildMaintenance, DatabaseBuildMaintenance};
use mkc_publications::check_recovery::{CheckRecovery, PublicationCheckRecovery};
use mkc_publications::transaction::StoreTransactions;
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime::SystemRuntime;
use uuid::Uuid;

/// One operator action on the publication and build check outboxes.
pub(crate) enum CheckCommand {
    /// Make one publication event due again.
    RequeuePublication(Uuid),
    /// Make one build check due again.
    RequeueBuild(Uuid),
    /// Count publication and build check dead letters.
    Status,
}

/// Recovery operations that require only database configuration.
pub(crate) trait RecoveryRunner {
    /// Run one check recovery or status action.
    fn checks(&self, command: CheckCommand) -> Result<()>;
    /// Requeue one billing event, or count dead letters when no event is given.
    fn billing(&self, event: Option<&str>) -> Result<()>;
}

/// Native store composition for trusted recovery commands.
pub(crate) struct SystemRecoveryRunner {
    /// Environment collaborator used only to read the database URL.
    pub(crate) environment: Arc<dyn Environment>,
}

impl RecoveryRunner for SystemRecoveryRunner {
    fn checks(&self, command: CheckCommand) -> Result<()> {
        let database_url = self
            .environment
            .get("MKC_DATABASE_URL")
            .filter(|url| !url.is_empty())
            .ok_or(settings::Error::Invalid("MKC_DATABASE_URL"))
            .context("load check recovery database")?;
        let factory: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        };
        let store = factory
            .connect(&database_url)
            .context("connect check recovery store")?;
        let recovery: &dyn CheckRecovery = &PublicationCheckRecovery {
            transactions: Arc::new(StoreTransactions {
                store: store.clone(),
            }),
            runtime: Arc::new(runtime::SystemRuntime),
        };
        match command {
            CheckCommand::RequeuePublication(event) => {
                let requeued = recovery
                    .requeue(event)
                    .context("requeue publication check")?;
                tracing::info!(%event, requeued, "publication check recovery");
            }
            CheckCommand::RequeueBuild(build) => {
                let recovery: &dyn BuildMaintenance = &DatabaseBuildMaintenance {
                    transactions: Arc::new(StoreTransactions { store }),
                    runtime: Arc::new(runtime::SystemRuntime),
                };
                let requeued = recovery
                    .requeue(BuildId(build))
                    .context("requeue build check")?;
                tracing::info!(%build, requeued, "build check recovery");
            }
            CheckCommand::Status => {
                let dead_letter_count = recovery
                    .dead_letters()
                    .context("inspect publication checks")?;
                tracing::info!(dead_letter_count, "publication check status");
            }
        }
        Ok(())
    }

    fn billing(&self, event: Option<&str>) -> Result<()> {
        let database_url = self
            .environment
            .get("MKC_DATABASE_URL")
            .filter(|url| !url.is_empty())
            .ok_or(settings::Error::Invalid("MKC_DATABASE_URL"))
            .context("load billing recovery database")?;
        let factory: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(SystemRuntime),
        };
        let recovery: &dyn BillingRecovery = &StoreBillingRecovery {
            store: factory
                .connect(&database_url)
                .context("connect billing recovery store")?,
            runtime: Arc::new(runtime::SystemRuntime),
        };
        if let Some(event) = event {
            let requeued = recovery
                .requeue(event)
                .context("requeue billing delivery")?;
            tracing::info!(%event, requeued, "billing delivery recovery");
        } else {
            let dead_letter_count = recovery
                .dead_letters()
                .context("inspect billing deliveries")?;
            tracing::info!(dead_letter_count, "billing delivery status");
        }
        Ok(())
    }
}
