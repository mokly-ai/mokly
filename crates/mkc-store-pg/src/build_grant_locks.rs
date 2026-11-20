//! Completion locks include parents and every publication that consumption can touch.

use diesel::prelude::*;
use diesel::sql_types::Uuid as SqlUuid;
use mkc_store_interface::error::{ErrorResultExt, Result};
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Locked {
    #[expect(dead_code, reason = "Diesel must map the locked row")]
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
}

impl PgQueries<'_> {
    pub(crate) fn lock_build_upload(&mut self, grant: Uuid) -> Result<bool> {
        if !self.lock_upload_rows(
            "SELECT p.id FROM projects p JOIN builds b ON b.project_id = p.id
             JOIN build_upload_grants g ON g.build_id = b.id WHERE g.id = $1
             FOR KEY SHARE OF p",
            grant,
        )? {
            return Ok(false);
        }
        if !self.lock_upload_rows(
            "SELECT b.id FROM builds b JOIN build_upload_grants g ON g.build_id = b.id
             WHERE g.id = $1 FOR UPDATE OF b",
            grant,
        )? {
            return Ok(false);
        }
        if !self.lock_upload_rows(
            "SELECT id FROM build_upload_grants WHERE id = $1 FOR UPDATE",
            grant,
        )? {
            return Ok(false);
        }
        self.lock_upload_rows(
            "SELECT p.id FROM publications p JOIN builds b ON
                (p.build_id = b.id OR (p.project_id = b.project_id AND p.head_sha = b.head_sha
                  AND p.config_path = b.config_path AND p.state = 'ready' AND p.expired_at IS NULL))
             JOIN build_upload_grants g ON g.build_id = b.id WHERE g.id = $1
             ORDER BY p.id FOR UPDATE OF p",
            grant,
        )?;
        Ok(true)
    }

    fn lock_upload_rows(&mut self, statement: &str, grant: Uuid) -> Result<bool> {
        Ok(!diesel::sql_query(statement)
            .bind::<SqlUuid, _>(grant)
            .load::<Locked>(self.connection)
            .context("lock build upload in parent, build, grant and publication order")?
            .is_empty())
    }
}
