//! Preserve public refusals while letting the store retry serializable work.

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Transaction};

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::service::BuildsService;

struct Work<'a> {
    operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    rejected: Option<ApiError>,
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

impl BuildsService {
    pub(super) fn transact(
        &self,
        read_only: bool,
        operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    ) -> Result<()> {
        let mut work = Work {
            operation,
            rejected: None,
        };
        if read_only {
            self.store.read(&mut work).context("read build API state")?;
        } else {
            self.store
                .transaction(&mut work)
                .context("commit build API work")?;
        }
        match work.rejected {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
