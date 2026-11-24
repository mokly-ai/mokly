//! Preserve public refusals while letting the store retry serializable work.

use mkc_store_interface::store::Queries;

use crate::error::{ApiErrorResultExt, Result};
use crate::store_work::ApiWork;

use super::service::BuildsService;

impl BuildsService {
    pub(super) fn transact(
        &self,
        read_only: bool,
        operation: &mut dyn FnMut(&mut dyn Queries) -> Result<()>,
    ) -> Result<()> {
        let mut work = ApiWork::new(operation);
        if read_only {
            self.store.read(&mut work).context("read build API state")?;
        } else {
            self.store
                .transaction(&mut work)
                .context("commit build API work")?;
        }
        work.finish()
    }
}
