//! Transactional policy rejection without treating expected outcomes as store failures.

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Transaction};

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::service::GitHubService;

pub(crate) struct Work<'a> {
    pub(crate) operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    pub(crate) rejected: Option<ApiError>,
}

impl Transaction for Work<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> error::Result<Decision> {
        self.rejected = None;
        match (self.operation)(queries) {
            Ok(()) => Ok(Decision::Commit),
            Err(ApiError::Internal(source)) => Err(error::Error::Internal(source)),
            Err(error) => {
                self.rejected = Some(error);
                Ok(Decision::Rollback)
            }
        }
    }
}

impl GitHubService {
    pub(super) fn transact(
        &self,
        read: bool,
        operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    ) -> Result<()> {
        let mut work = Work {
            operation,
            rejected: None,
        };
        if read {
            self.store
                .read(&mut work)
                .context("read GitHub service state")?;
        } else {
            self.store
                .transaction(&mut work)
                .context("commit GitHub service state")?;
        }
        match work.rejected {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
