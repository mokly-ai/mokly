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
/// The pool keeps no idle session. r2d2 opens kept sessions on a background
/// thread, and a process that exits while one is opening crashes in the
/// OpenSSL exit handler. Without kept sessions, a session opens only while a
/// call waits for it.
const IDLE_POOL_SIZE: u32 = 0;
/// Idle time after which the pool closes a session. The pool checks every 30
/// seconds, so a session closes 60 to 90 seconds after its last call.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

/// Composition-root factory for a shared store interface.
pub trait StoreFactory {
    /// Connect with a pool of up to eight sessions that opens each session
    /// when a call needs it, and a five-second acquisition timeout.
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
        // Open one session now, so an unreachable database fails at startup.
        drop(pool.get().context("connect platform store")?);
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
