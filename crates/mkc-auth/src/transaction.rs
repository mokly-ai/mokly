//! Keep policy rejections in the service while permitting store-level retries.

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Transaction};

use crate::error::{Error, ErrorResultExt, Result};
use crate::service::AuthService;

struct Work<'a> {
    operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    rejected: Option<Error>,
}

impl Transaction for Work<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> error::Result<Decision> {
        self.rejected = None;
        match (self.operation)(queries) {
            Ok(()) => Ok(Decision::Commit),
            Err(Error::Internal(source)) => Err(error::Error::Internal(source)),
            Err(rejected) => {
                self.rejected = Some(rejected);
                Ok(Decision::Rollback)
            }
        }
    }
}

impl AuthService {
    pub(crate) fn transact(
        &self,
        read_only: bool,
        operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    ) -> Result<()> {
        let mut work = Work {
            operation,
            rejected: None,
        };
        if read_only {
            self.store.read(&mut work).context("read service state")?;
        } else {
            self.store
                .transaction(&mut work)
                .context("commit service work")?;
        }
        match work.rejected {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
