//! Transaction-local time bounds for authentication retention statements.

use diesel::prelude::*;
use diesel::sql_types::Text;
use mkc_store_interface::auth_prune::PruneBatch;
use mkc_store_interface::error::{ErrorResultExt, Result};

/// Keep SQL lock and execution waits bounded through transaction commit.
pub(crate) fn configure_batch(connection: &mut PgConnection, batch: PruneBatch) -> Result<i64> {
    let timeout = format!("{}ms", batch.timeout.as_millis().clamp(1, 5_000));
    diesel::sql_query("SELECT set_config('statement_timeout', $1, true)")
        .bind::<Text, _>(timeout)
        .execute(connection)
        .context("limit authentication prune statement time")?;
    Ok(i64::from(batch.limit.min(1_000)))
}
