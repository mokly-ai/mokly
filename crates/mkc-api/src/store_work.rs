//! Preserve API refusals across the store's transaction boundary.

use mkc_store_interface::error;
use mkc_store_interface::store::{Decision, Queries, Transaction};

use crate::error::{ApiError, Result};

pub(crate) struct ApiWork<'a> {
    operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    rejected: Option<ApiError>,
}

impl<'a> ApiWork<'a> {
    pub(crate) fn new(operation: &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>) -> Self {
        Self {
            operation,
            rejected: None,
        }
    }

    pub(crate) fn finish(self) -> Result<()> {
        self.rejected.map_or(Ok(()), Err)
    }
}

impl Transaction for ApiWork<'_> {
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
