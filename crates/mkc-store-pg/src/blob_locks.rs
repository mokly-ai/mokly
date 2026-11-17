//! Canonical pre-locks for operations that release blob references indirectly.
//!
//! Every multi-row blob transaction takes its rows in ascending project, then
//! hash order; `COLLATE "C"` sorts the hash bytewise, matching the service's
//! `BlobHash` ordering whatever the database's default collation. Postgres
//! applies `FOR UPDATE` in result order for this query shape, so the locks are
//! acquired in sorted order before the cascade triggers touch the rows. Each
//! delete implementation calls its pre-lock itself; it is not a separate
//! service step a caller could omit.

use diesel::prelude::*;
use diesel::sql_types::{Array, Text, Uuid as SqlUuid};
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId};
use mkc_store_interface::error::{ErrorResultExt, Result};

#[derive(QueryableByName)]
struct LockedBlob {
    #[expect(dead_code, reason = "Diesel must map the selected lock row")]
    #[diesel(sql_type = SqlUuid)]
    project_id: uuid::Uuid,
    #[expect(dead_code, reason = "Diesel must map the selected lock row")]
    #[diesel(sql_type = Text)]
    hash: String,
}

pub(crate) fn for_publication(
    connection: &mut PgConnection,
    publication: PublicationId,
) -> Result<()> {
    lock(
        connection,
        "SELECT b.project_id, b.hash FROM blobs b WHERE EXISTS (SELECT 1 FROM publication_files pf WHERE pf.publication_id = $1 AND pf.project_id = b.project_id AND pf.blob_hash = b.hash) ORDER BY b.project_id, b.hash COLLATE \"C\" FOR UPDATE",
        publication.0,
    )
}

pub(crate) fn for_project(connection: &mut PgConnection, project: ProjectId) -> Result<()> {
    lock(
        connection,
        "SELECT b.project_id, b.hash FROM blobs b WHERE b.project_id = $1 AND EXISTS (SELECT 1 FROM publication_files pf WHERE pf.project_id = b.project_id AND pf.blob_hash = b.hash) ORDER BY b.project_id, b.hash COLLATE \"C\" FOR UPDATE",
        project.0,
    )
}

pub(crate) fn for_organization(
    connection: &mut PgConnection,
    organization: OrganizationId,
) -> Result<()> {
    lock(
        connection,
        "SELECT b.project_id, b.hash FROM blobs b WHERE EXISTS (SELECT 1 FROM publication_files pf JOIN projects pr ON pr.id = pf.project_id WHERE pr.organization_id = $1 AND pf.project_id = b.project_id AND pf.blob_hash = b.hash) ORDER BY b.project_id, b.hash COLLATE \"C\" FOR UPDATE",
        organization.0,
    )
}

fn lock(connection: &mut PgConnection, statement: &str, owner: uuid::Uuid) -> Result<()> {
    let _rows = diesel::sql_query(statement)
        .bind::<SqlUuid, _>(owner)
        .load::<LockedBlob>(connection)
        .context("lock referenced blobs in canonical project and hash order")?;
    Ok(())
}

/// Pre-lock all references that build pruning releases, across the complete batch.
pub(crate) fn for_failed_build_uploads(
    connection: &mut PgConnection,
    builds: &[uuid::Uuid],
) -> Result<()> {
    diesel::sql_query(
        "SELECT b.project_id, b.hash FROM blobs b WHERE EXISTS (
        SELECT 1 FROM publication_files pf JOIN publications p ON p.id = pf.publication_id
        WHERE p.build_id = ANY($1) AND p.state = 'failed'
          AND pf.project_id = b.project_id AND pf.blob_hash = b.hash)
        ORDER BY b.project_id, b.hash COLLATE \"C\" FOR UPDATE",
    )
    .bind::<Array<SqlUuid>, _>(builds)
    .load::<LockedBlob>(connection)
    .context("lock failed build uploads' blobs in canonical order")?;
    Ok(())
}
