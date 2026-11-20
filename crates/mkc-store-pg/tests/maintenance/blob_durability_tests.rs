//! Blob durability queries fence incarnations and report pending references.

use chrono::Utc;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::database;
use super::records::{blob, file, validating_publication};

#[test]
fn stored_marking_is_incarnation_fenced_non_deleting_and_idempotent() {
    let Some(db) = database() else { return };
    let publication = validating_publication(&db);
    let blob = blob(publication.project_id, b"durable");
    let wrong_incarnation = BlobKey {
        incarnation: Uuid::now_v7(),
        ..blob.key.clone()
    };
    let before = Utc::now();
    let mut first_timestamp = None;
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&blob)?;
            assert!(
                queries
                    .blob(blob.project_id, &blob.key.hash)?
                    .unwrap()
                    .stored_at
                    .is_none()
            );
            assert!(!queries.mark_blob_stored(&wrong_incarnation)?);
            assert!(queries.mark_blob_stored(&blob.key)?);
            first_timestamp = queries
                .blob(blob.project_id, &blob.key.hash)?
                .unwrap()
                .stored_at;
            Ok(())
        }))
        .unwrap();
    let first_timestamp = first_timestamp.unwrap();
    assert!(first_timestamp >= before && first_timestamp <= Utc::now());

    db.store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.mark_blob_stored(&blob.key)?);
            assert_eq!(
                queries
                    .blob(blob.project_id, &blob.key.hash)?
                    .unwrap()
                    .stored_at,
                Some(first_timestamp)
            );
            assert!(queries.mark_blob_deleting(&blob.key)?);
            assert!(!queries.mark_blob_stored(&blob.key)?);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn pending_hashes_are_sorted_distinct_and_shrink_after_partial_marking() {
    let Some(db) = database() else { return };
    let publication = validating_publication(&db);
    let first = blob(publication.project_id, b"first pending blob");
    let second = blob(publication.project_id, b"second pending blob");
    let mut expected = vec![first.key.hash.clone(), second.key.hash.clone()];
    expected.sort();

    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&first)?;
            queries.insert_blob(&second)?;
            queries.insert_publication_file(&file(&publication, "one.txt", &first))?;
            queries.insert_publication_file(&file(&publication, "duplicate.txt", &first))?;
            queries.insert_publication_file(&file(&publication, "two.txt", &second))?;
            assert_eq!(queries.pending_publication_blobs(publication.id)?, expected);
            assert!(queries.mark_blob_stored(&first.key)?);
            assert_eq!(
                queries.pending_publication_blobs(publication.id)?,
                vec![second.key.hash.clone()]
            );
            assert!(queries.mark_blob_stored(&second.key)?);
            assert!(
                queries
                    .pending_publication_blobs(publication.id)?
                    .is_empty()
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn identical_hashes_are_scoped_to_projects_and_exact_incarnations() {
    let Some(db) = database() else { return };
    let first_publication = validating_publication(&db);
    let second_publication = validating_publication(&db);
    let first = blob(first_publication.project_id, b"same project-owned bytes");
    let second = blob(second_publication.project_id, b"same project-owned bytes");
    assert_eq!(first.key.hash, second.key.hash);
    assert_ne!(first.key.incarnation, second.key.incarnation);

    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&first)?;
            queries.insert_blob(&second)?;
            queries.insert_publication_file(&file(&first_publication, "same.txt", &first))?;
            queries.insert_publication_file(&file(&second_publication, "same.txt", &second))?;

            assert_eq!(
                queries
                    .blob(first.project_id, &first.key.hash)?
                    .unwrap()
                    .key,
                first.key
            );
            assert_eq!(
                queries.blob_by_key(&second.key)?.unwrap().project_id,
                second.project_id
            );
            assert!(queries.mark_blob_stored(&first.key)?);
            assert!(
                queries
                    .pending_publication_blobs(first_publication.id)?
                    .is_empty()
            );
            assert_eq!(
                queries.pending_publication_blobs(second_publication.id)?,
                vec![second.key.hash.clone()]
            );
            assert_eq!(
                queries
                    .publication_file(second_publication.id, "same.txt")?
                    .unwrap()
                    .key,
                second.key
            );
            Ok(())
        }))
        .unwrap();
}

#[test]
fn reserved_blob_lookup_reads_only_the_publications_own_project_row() {
    let Some(db) = database() else { return };
    let first_publication = validating_publication(&db);
    let second_publication = validating_publication(&db);
    let first = blob(first_publication.project_id, b"reserved by both projects");
    let second = blob(second_publication.project_id, b"reserved by both projects");
    let unreserved = BlobHash::digest(b"never reserved");

    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&first)?;
            queries.insert_blob(&second)?;
            queries.insert_publication_file(&file(&first_publication, "a.txt", &first))?;
            queries.insert_publication_file(&file(&second_publication, "b.txt", &second))?;
            assert!(queries.mark_blob_stored(&second.key)?);

            let reserved = queries
                .publication_blob(first_publication.id, &first.key.hash)?
                .unwrap();
            assert_eq!(reserved.key, first.key);
            assert_eq!(reserved.project_id, first_publication.project_id);
            assert!(reserved.stored_at.is_none());
            let durable = queries
                .publication_blob(second_publication.id, &second.key.hash)?
                .unwrap();
            assert_eq!(durable.key, second.key);
            assert!(durable.stored_at.is_some());
            assert!(
                queries
                    .publication_blob(first_publication.id, &unreserved)?
                    .is_none()
            );
            Ok(())
        }))
        .unwrap();
}
