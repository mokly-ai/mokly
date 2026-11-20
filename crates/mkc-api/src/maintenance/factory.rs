//! Database and file-store composition for failed-upload and object cleanup.

use std::sync::Arc;

use mkc_auth::runtime::{Runtime, SystemRuntime};
use mkc_config::maintenance::PublicationMaintenanceSettings;
use mkc_publications::garbage_collection::BlobGarbageCollector;
use mkc_publications::maintenance::{Maintenance, PublicationMaintenance};
use mkc_publications::retention::PublicationRetention;
use mkc_publications::transaction::{StoreTransactions, Transactions};
use mkc_store_pg::connection::{PgStoreFactory, StoreFactory};
use mkc_store_pg::runtime;

use crate::error::{ApiErrorResultExt, Result};
use crate::publishing_storage::{StorageFactory, SystemStorageFactory};

/// Composition boundary for the scheduled publication maintenance command.
pub trait PublicationMaintenanceFactory {
    /// Connect validated dependencies and return the complete runner.
    fn create(
        &self,
        settings: &PublicationMaintenanceSettings,
    ) -> Result<Arc<dyn PublicationMaintenance>>;
}

/// Production factory using Postgres and the shared publishing file store.
pub struct SystemPublicationMaintenanceFactory;

impl PublicationMaintenanceFactory for SystemPublicationMaintenanceFactory {
    fn create(
        &self,
        settings: &PublicationMaintenanceSettings,
    ) -> Result<Arc<dyn PublicationMaintenance>> {
        let stores: &dyn StoreFactory = &PgStoreFactory {
            runtime: Arc::new(runtime::SystemRuntime),
        };
        let store = stores
            .connect(&settings.database_url)
            .context("connect publication maintenance store")?;
        let transactions: Arc<dyn Transactions> = Arc::new(StoreTransactions { store });
        let storage: &dyn StorageFactory = &SystemStorageFactory;
        let files = storage.create(&settings.storage)?.files;
        let clock: Arc<dyn Runtime> = Arc::new(SystemRuntime);
        Ok(Arc::new(Maintenance {
            retention: Arc::new(PublicationRetention {
                transactions: transactions.clone(),
                runtime: clock.clone(),
            }),
            garbage: Arc::new(BlobGarbageCollector {
                transactions,
                files,
                runtime: clock,
            }),
        }))
    }
}
