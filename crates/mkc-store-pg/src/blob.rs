//! Blob reservation, reference lookup and fenced garbage-collection queries.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Nullable, Timestamptz};
use mkc_db::schema::publication::{blobs, publication_files, publications};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::blob::{Blob, Blobs, PublicationFile};
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use uuid::Uuid;

use crate::blob_locks;
use crate::queries::PgQueries;

/// A ready publication serves its catalogue from its file list, so only an
/// unfinished, failed or expired publication may release it.
#[derive(Debug, thiserror::Error)]
#[error("[mkc-store-pg/blob] a ready publication keeps its file list until it expires")]
struct ReadyPublicationFiles;

#[derive(Queryable, QueryableByName, Selectable, Insertable)]
#[diesel(table_name = blobs)]
struct BlobRow {
    project_id: Uuid,
    hash: String,
    incarnation: Uuid,
    size: i64,
    content_type: String,
    ref_count: i64,
    deleting: bool,
    unreferenced_at: Option<DateTime<Utc>>,
    stored_at: Option<DateTime<Utc>>,
}

impl BlobRow {
    fn dto(self) -> Result<Blob> {
        Ok(Blob {
            project_id: self.project_id.into(),
            key: BlobKey {
                hash: self.hash.parse().context("decode stored blob hash")?,
                incarnation: self.incarnation,
            },
            size: self.size,
            content_type: self.content_type,
            ref_count: self.ref_count,
            deleting: self.deleting,
            unreferenced_at: self.unreferenced_at,
            stored_at: self.stored_at,
        })
    }
}

type FileRow = (Uuid, Uuid, String, String, String, Uuid, i64);

fn file_dto(row: FileRow) -> Result<PublicationFile> {
    Ok(PublicationFile {
        publication_id: row.0.into(),
        project_id: row.1.into(),
        path: row.2,
        key: BlobKey {
            hash: row.3.parse().context("decode indexed blob hash")?,
            incarnation: row.5,
        },
        content_type: row.4,
        size: row.6,
    })
}

impl Blobs for PgQueries<'_> {
    fn blob(&mut self, project: ProjectId, hash: &BlobHash) -> Result<Option<Blob>> {
        blobs::table
            .filter(blobs::project_id.eq(project.0))
            .filter(blobs::hash.eq(hash.as_str()))
            .select(BlobRow::as_select())
            .first(self.connection)
            .optional()
            .context("read content reservation")?
            .map(BlobRow::dto)
            .transpose()
    }

    fn blob_by_key(&mut self, key: &BlobKey) -> Result<Option<Blob>> {
        blobs::table
            .filter(blobs::hash.eq(key.hash.as_str()))
            .filter(blobs::incarnation.eq(key.incarnation))
            .select(BlobRow::as_select())
            .first(self.connection)
            .optional()
            .context("read exact content incarnation")?
            .map(BlobRow::dto)
            .transpose()
    }

    fn insert_blob(&mut self, blob: &Blob) -> Result<()> {
        diesel::insert_into(blobs::table)
            .values(BlobRow {
                project_id: blob.project_id.0,
                hash: blob.key.hash.to_string(),
                incarnation: blob.key.incarnation,
                size: blob.size,
                content_type: blob.content_type.clone(),
                ref_count: 0,
                deleting: false,
                unreferenced_at: blob.unreferenced_at,
                stored_at: None,
            })
            .execute(self.connection)
            .context("reserve new content incarnation")?;
        Ok(())
    }

    fn insert_publication_file(&mut self, file: &PublicationFile) -> Result<()> {
        diesel::insert_into(publication_files::table)
            .values((
                publication_files::publication_id.eq(file.publication_id.0),
                publication_files::project_id.eq(file.project_id.0),
                publication_files::path.eq(&file.path),
                publication_files::blob_hash.eq(file.key.hash.as_str()),
                publication_files::content_type.eq(&file.content_type),
            ))
            .execute(self.connection)
            .context("reserve publication file reference")?;
        Ok(())
    }

    fn publication_file(
        &mut self,
        publication: PublicationId,
        path: &str,
    ) -> Result<Option<PublicationFile>> {
        publication_files::table
            .inner_join(
                blobs::table.on(blobs::project_id
                    .eq(publication_files::project_id)
                    .and(blobs::hash.eq(publication_files::blob_hash))),
            )
            .filter(publication_files::publication_id.eq(publication.0))
            .filter(publication_files::path.eq(path))
            .select((
                publication_files::publication_id,
                publication_files::project_id,
                publication_files::path,
                publication_files::blob_hash,
                publication_files::content_type,
                blobs::incarnation,
                blobs::size,
            ))
            .first::<FileRow>(self.connection)
            .optional()
            .context("read publication path")?
            .map(file_dto)
            .transpose()
    }

    fn publication_files(&mut self, publication: PublicationId) -> Result<Vec<PublicationFile>> {
        publication_files::table
            .inner_join(
                blobs::table.on(blobs::project_id
                    .eq(publication_files::project_id)
                    .and(blobs::hash.eq(publication_files::blob_hash))),
            )
            .filter(publication_files::publication_id.eq(publication.0))
            .order(publication_files::path.asc())
            .select((
                publication_files::publication_id,
                publication_files::project_id,
                publication_files::path,
                publication_files::blob_hash,
                publication_files::content_type,
                blobs::incarnation,
                blobs::size,
            ))
            .load::<FileRow>(self.connection)
            .context("read publication path inventory")?
            .into_iter()
            .map(file_dto)
            .collect()
    }

    fn mark_blob_stored(&mut self, key: &BlobKey) -> Result<bool> {
        Ok(diesel::update(
            blobs::table
                .filter(blobs::hash.eq(key.hash.as_str()))
                .filter(blobs::incarnation.eq(key.incarnation))
                .filter(blobs::deleting.eq(false)),
        )
        .set(
            blobs::stored_at.eq(diesel::dsl::sql::<Nullable<Timestamptz>>(
                "COALESCE(stored_at, clock_timestamp())",
            )),
        )
        .execute(self.connection)
        .context("confirm durable content incarnation")?
            == 1)
    }

    fn pending_publication_blobs(&mut self, publication: PublicationId) -> Result<Vec<BlobHash>> {
        publication_files::table
            .inner_join(
                blobs::table.on(blobs::project_id
                    .eq(publication_files::project_id)
                    .and(blobs::hash.eq(publication_files::blob_hash))),
            )
            .filter(publication_files::publication_id.eq(publication.0))
            .filter(blobs::stored_at.is_null())
            .select(publication_files::blob_hash)
            .distinct()
            .order(publication_files::blob_hash.asc())
            .load::<String>(self.connection)
            .context("read pending publication blobs")?
            .into_iter()
            .map(|hash| hash.parse().context("decode pending blob hash"))
            .collect()
    }

    fn publication_blob(
        &mut self,
        publication: PublicationId,
        hash: &BlobHash,
    ) -> Result<Option<Blob>> {
        publication_files::table
            .inner_join(
                blobs::table.on(blobs::project_id
                    .eq(publication_files::project_id)
                    .and(blobs::hash.eq(publication_files::blob_hash))),
            )
            .filter(publication_files::publication_id.eq(publication.0))
            .filter(publication_files::blob_hash.eq(hash.as_str()))
            .select(BlobRow::as_select())
            .first(self.connection)
            .optional()
            .context("read reserved publication blob")?
            .map(BlobRow::dto)
            .transpose()
    }

    fn delete_publication_files(&mut self, publication: PublicationId) -> Result<()> {
        let state = publications::table
            .find(publication.0)
            .select(publications::state)
            .for_share()
            .first::<String>(self.connection)
            .optional()
            .context("read the state of the publication releasing its files")?;
        if state.as_deref() == Some("ready") {
            return Err(Error::internal(ReadyPublicationFiles));
        }
        blob_locks::for_publication(self.connection, publication)?;
        diesel::delete(
            publication_files::table.filter(publication_files::publication_id.eq(publication.0)),
        )
        .execute(self.connection)
        .context("release publication file references")?;
        Ok(())
    }

    fn garbage_blobs(&mut self, before: DateTime<Utc>, limit: i64) -> Result<Vec<Blob>> {
        diesel::sql_query(include_str!("garbage_candidates.sql"))
            .bind::<Timestamptz, _>(before)
            .bind::<BigInt, _>(limit.clamp(1, 1000))
            .load::<BlobRow>(self.connection)
            .context("list expired unreferenced blobs")?
            .into_iter()
            .map(BlobRow::dto)
            .collect()
    }

    fn mark_blob_deleting(&mut self, key: &BlobKey) -> Result<bool> {
        Ok(diesel::update(
            blobs::table
                .filter(blobs::hash.eq(key.hash.as_str()))
                .filter(blobs::incarnation.eq(key.incarnation))
                .filter(blobs::ref_count.eq(0)),
        )
        .set(blobs::deleting.eq(true))
        .execute(self.connection)
        .context("fence garbage collection")?
            == 1)
    }

    fn delete_blob_record(&mut self, key: &BlobKey) -> Result<bool> {
        Ok(diesel::delete(
            blobs::table
                .filter(blobs::hash.eq(key.hash.as_str()))
                .filter(blobs::incarnation.eq(key.incarnation))
                .filter(blobs::ref_count.eq(0))
                .filter(blobs::deleting.eq(true)),
        )
        .execute(self.connection)
        .context("finish fenced content deletion")?
            == 1)
    }
}
