//! File references and observable row locks for lock-order regression tests.

use diesel::prelude::*;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::publication::{Publication, PublicationFailure, PublicationState};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::support::Fixture;

pub(super) fn upload(f: &Fixture, build: &NewBuild, bytes: &[u8]) -> (Publication, Blob) {
    let mut p = f.publication(build);
    p.state = PublicationState::Validating;
    p.changes = None;
    let blob = Blob {
        project_id: build.project_id,
        key: BlobKey {
            hash: BlobHash::digest(bytes),
            incarnation: Uuid::now_v7(),
        },
        size: bytes.len() as i64,
        content_type: "text/html".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(f.now),
        stored_at: None,
    };
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&p)?;
            q.insert_blob(&blob)?;
            q.insert_publication_file(&PublicationFile {
                publication_id: p.id,
                project_id: build.project_id,
                path: "index.html".into(),
                key: blob.key.clone(),
                size: blob.size,
                content_type: blob.content_type.clone(),
            })
        }))
        .unwrap();
    (p, blob)
}

pub(super) fn assert_locked(connection: &mut PgConnection, table: &str, id: Uuid) {
    let statement = format!("SELECT id FROM {table} WHERE id = $1 FOR UPDATE NOWAIT");
    let result = connection
        .build_transaction()
        .read_committed()
        .run::<_, diesel::result::Error, _>(|connection| {
            diesel::sql_query(&statement)
                .bind::<diesel::sql_types::Uuid, _>(id)
                .execute(connection)
        });
    assert!(
        result.is_err(),
        "{table}/{id} must be locked before the first blob"
    );
}

pub(super) fn lock_blob(connection: &mut PgConnection, blob: &Blob) {
    diesel::sql_query(
        "SELECT incarnation FROM blobs WHERE project_id = $1 AND hash = $2 FOR UPDATE",
    )
    .bind::<diesel::sql_types::Uuid, _>(blob.project_id.0)
    .bind::<diesel::sql_types::Text, _>(blob.key.hash.to_string())
    .execute(connection)
    .unwrap();
}

pub(super) fn fail(f: &Fixture, p: &Publication) {
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.fail_publication(p.id, PublicationFailure::Expired)?;
            Ok(())
        }))
        .unwrap();
}
