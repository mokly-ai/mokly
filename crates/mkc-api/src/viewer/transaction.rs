//! Explicit rollback of read policy rejections without store error translation.

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Transaction};

use crate::platform::error::{Error, ErrorResultExt, Result};

use super::service::ViewerService;

struct Work<'a> {
    operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    rejected: Option<Error>,
}

impl Transaction for Work<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> error::Result<Decision> {
        match (self.operation)(queries) {
            Ok(()) => Ok(Decision::Commit),
            Err(Error::Internal(source)) => Err(error::Error::Internal(source)),
            Err(error) => {
                self.rejected = Some(error);
                Ok(Decision::Rollback)
            }
        }
    }
}

impl ViewerService {
    pub(super) fn read(
        &self,
        operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    ) -> Result<()> {
        let mut work = Work {
            operation,
            rejected: None,
        };
        self.store.read(&mut work).context("read viewer state")?;
        match work.rejected {
            Some(error) => Err(error),
            None => Ok(()),
        }
    }
}
