//! Bounded retention queries for GitHub OAuth flows and terminal deliveries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Timestamptz};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_retention::GitHubRetention;

use crate::queries::PgQueries;

impl GitHubRetention for PgQueries<'_> {
    fn prune_github_oauth_flows(&mut self, before: DateTime<Utc>, limit: i64) -> Result<usize> {
        diesel::sql_query(include_str!("github_oauth_retention.sql"))
            .bind::<Timestamptz, _>(before)
            .bind::<BigInt, _>(limit.clamp(1, 1000))
            .execute(self.connection)
            .context("prune GitHub OAuth flows")
    }

    fn prune_github_deliveries(&mut self, before: DateTime<Utc>, limit: i64) -> Result<usize> {
        diesel::sql_query(include_str!("github_delivery_retention.sql"))
            .bind::<Timestamptz, _>(before)
            .bind::<BigInt, _>(limit.clamp(1, 1000))
            .execute(self.connection)
            .context("prune terminal GitHub deliveries")
    }
}
