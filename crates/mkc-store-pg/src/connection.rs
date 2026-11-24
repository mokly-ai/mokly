//! Bounded connection pool and serializable query transactions.

use std::sync::Arc;
use std::time::Duration;

use diesel::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::store::{Store, Transaction};

use crate::queries::PgQueries;
use crate::retry::{Attempt, Backoff, Retry};
use crate::runtime::Runtime;
use crate::transaction::DatabaseAttempt;

const DEFAULT_POOL_SIZE: u32 = 8;
/// Sessions an idle pool keeps open, so idle pods leave slots for busy ones.
const IDLE_POOL_SIZE: u32 = 1;
/// Idle time after which the pool closes a session, the last one included.
/// The pool checks every 30 seconds and opens a replacement in the background
/// to keep `IDLE_POOL_SIZE` sessions ready.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

/// Composition-root factory for a shared store interface.
pub trait StoreFactory {
    /// Connect with a bounded pool that opens sessions on demand and a
    /// five-second acquisition timeout.
    fn connect(&self, database_url: &str) -> Result<Arc<dyn Store>>;
}

/// Creates the Postgres adapter without exposing its runtime concrete type.
pub struct PgStoreFactory {
    /// Injected retry sleep and entropy source.
    pub runtime: Arc<dyn Runtime>,
}

struct PgStore {
    pool: Pool<ConnectionManager<PgConnection>>,
    runtime: Arc<dyn Runtime>,
}

impl StoreFactory for PgStoreFactory {
    fn connect(&self, database_url: &str) -> Result<Arc<dyn Store>> {
        let pool = Pool::builder()
            .max_size(DEFAULT_POOL_SIZE)
            .min_idle(Some(IDLE_POOL_SIZE))
            .idle_timeout(Some(IDLE_TIMEOUT))
            .connection_timeout(Duration::from_secs(5))
            .build(ConnectionManager::new(database_url))
            .context("connect platform store")?;
        Ok(Arc::new(PgStore {
            pool,
            runtime: self.runtime.clone(),
        }))
    }
}

impl Store for PgStore {
    fn transaction(&self, work: &mut dyn Transaction) -> Result<()> {
        let mut connection = self.pool.get().context("acquire platform connection")?;
        let retry: &dyn Retry = &Backoff {
            runtime: self.runtime.as_ref(),
        };
        retry.execute(&mut DatabaseAttempt {
            connection: &mut connection,
            work,
            read_only: false,
        })
    }

    fn read(&self, work: &mut dyn Transaction) -> Result<()> {
        let mut connection = self.pool.get().context("acquire read connection")?;
        let attempt: &mut dyn Attempt = &mut DatabaseAttempt {
            connection: &mut connection,
            work,
            read_only: true,
        };
        attempt.run()
    }

    fn autocommit(&self, work: &mut dyn Transaction) -> Result<()> {
        let mut connection = self.pool.get().context("acquire autocommit connection")?;
        work.run(&mut PgQueries {
            connection: &mut connection,
        })?;
        Ok(())
    }
}
