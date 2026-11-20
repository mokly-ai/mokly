//! Retry-safe query execution with caller-owned policy rollbacks.

use std::sync::Arc;

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Store, Transaction};

use crate::error::{Error, ErrorResultExt, Result};

/// Query callback contract; no external effects. Build ownership queries may
/// sample their injected clock guard after locks on each attempt.
pub type QueryWork<'a> = dyn FnMut(&mut dyn Queries) -> Result<()> + 'a;

/// Service transaction seam with explicit read/write behavior.
#[unimock::unimock(api = TransactionsMock)]
pub trait Transactions: Send + Sync {
    /// Execute read-only work once, or serializable work with store retries.
    fn run(&self, read_only: bool, work: &mut QueryWork<'_>) -> Result<()>;
}

/// Adapter preserving the shared store's retry and rollback semantics.
pub struct StoreTransactions {
    /// Injected query executor.
    pub store: Arc<dyn Store>,
}

struct Work<'a, 'b> {
    operation: &'a mut QueryWork<'b>,
    rejection: Option<Error>,
}

impl Transaction for Work<'_, '_> {
    fn run(&mut self, queries: &mut dyn Queries) -> error::Result<Decision> {
        self.rejection = None;
        match (self.operation)(queries) {
            Ok(()) => Ok(Decision::Commit),
            Err(Error::Internal(source)) => Err(error::Error::Internal(source)),
            Err(error) => {
                self.rejection = Some(error);
                Ok(Decision::Rollback)
            }
        }
    }
}

impl Transactions for StoreTransactions {
    fn run(&self, read_only: bool, operation: &mut QueryWork<'_>) -> Result<()> {
        let mut work = Work {
            operation,
            rejection: None,
        };
        if read_only {
            self.store
                .read(&mut work)
                .context("read publication service state")?;
        } else {
            self.store
                .transaction(&mut work)
                .context("commit publication service state")?;
        }
        match work.rejection {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
