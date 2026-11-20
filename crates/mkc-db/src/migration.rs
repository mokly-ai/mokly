//! Embedded migrations applied under a connection-scoped advisory lock.

use std::error;
use std::result;
use std::sync::Arc;
use std::time::Duration;

use diesel::r2d2::{ConnectionManager, Pool};
use diesel::{Connection, PgConnection, RunQueryDsl};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use internal_error::InternalError;
use thiserror::Error;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Migration and database connection failures.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// Preserved database or migration failure.
    #[error("[mkc-db/migration] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Migration operation result.
pub type Result<T> = result::Result<T, Error>;

#[derive(Debug, Error)]
enum MigrationFailure {
    #[error("[mkc-db/migration] migration source: {0}")]
    Apply(#[source] Box<dyn error::Error + Send + Sync>),
    #[error("[mkc-db/migration] pending migration read: {0}")]
    Pending(#[source] Box<dyn error::Error + Send + Sync>),
}

/// Migration runner consumed by API and test composition roots.
#[cfg_attr(feature = "unimock", unimock::unimock(api = MigrateMock))]
pub trait MigrationRunner: Send + Sync {
    /// Apply all pending migrations; concurrent runners serialize.
    fn migrate(&self, database_url: &str) -> Result<()>;
}

/// Diesel's embedded migration implementation.
pub struct DieselMigrations;

impl MigrationRunner for DieselMigrations {
    fn migrate(&self, database_url: &str) -> Result<()> {
        let mut connection =
            PgConnection::establish(database_url).context("connect for migrations")?;
        diesel::sql_query("SELECT pg_advisory_lock(739217004)")
            .execute(&mut connection)
            .context("lock migrations")?;
        let result = connection.run_pending_migrations(MIGRATIONS).map(|_| ());
        let unlock =
            diesel::sql_query("SELECT pg_advisory_unlock(739217004)").execute(&mut connection);
        if let Err(source) = result {
            return Err(Error::internal(MigrationFailure::Apply(source)));
        }
        unlock.context("unlock migrations")?;
        Ok(())
    }
}

/// Read-only readiness boundary, backed by a bounded connection pool.
#[cfg_attr(feature = "unimock", unimock::unimock(api = [CurrentMock]))]
pub trait MigrationStatus: Send + Sync {
    /// Check for pending embedded migrations without applying them.
    fn is_current(&self) -> Result<bool>;
}

/// Composition boundary for pooled migration readiness.
pub trait MigrationStatusFactory {
    /// Connect a readiness reader with at most one connection and a five-second wait.
    fn connect(&self, database_url: &str) -> Result<Arc<dyn MigrationStatus>>;
}

/// Dedicated readiness pool; product queries retain the store's private pool.
pub struct PooledMigrationStatusFactory;

struct PooledMigrationStatus {
    pool: Pool<ConnectionManager<PgConnection>>,
}

impl MigrationStatusFactory for PooledMigrationStatusFactory {
    fn connect(&self, database_url: &str) -> Result<Arc<dyn MigrationStatus>> {
        let pool = Pool::builder()
            .max_size(1)
            .min_idle(Some(0))
            .connection_timeout(Duration::from_secs(5))
            .build(ConnectionManager::new(database_url))
            .context("connect migration readiness pool")?;
        Ok(Arc::new(PooledMigrationStatus { pool }))
    }
}

impl MigrationStatus for PooledMigrationStatus {
    fn is_current(&self) -> Result<bool> {
        let mut connection = self
            .pool
            .get()
            .context("acquire migration readiness connection")?;
        match connection.has_pending_migration(MIGRATIONS) {
            Ok(pending) => Ok(!pending),
            Err(source) => Err(Error::internal(MigrationFailure::Pending(source))),
        }
    }
}
