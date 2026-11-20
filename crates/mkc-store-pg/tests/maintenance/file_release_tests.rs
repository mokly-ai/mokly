//! A published catalogue keeps its file list; only unfinished, failed or expired
//! publications release it.

use chrono::Utc;
use mkc_store_interface::error::Error;
use mkc_store_interface::publication::{Publication, PublicationFailure};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::Callback;

use super::fixtures::{Database, database};
use super::records::{blob, file, validating_publication};

/// A validating publication with one durable indexed file.
fn indexed(db: &Database, content: &[u8]) -> Publication {
    let publication = validating_publication(db);
    let stored = blob(publication.project_id, content);
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_blob(&stored)?;
            queries.insert_publication_file(&file(&publication, "index.html", &stored))?;
            assert!(queries.mark_blob_stored(&stored.key)?);
            Ok(())
        }))
        .unwrap();
    publication
}

fn files(db: &Database, publication: &Publication) -> usize {
    let mut count = 0;
    db.store
        .transaction(&mut Callback(&mut |queries| {
            count = queries.publication_files(publication.id)?.len();
            Ok(())
        }))
        .unwrap();
    count
}

#[test]
fn a_ready_publication_keeps_its_file_list_until_it_expires() {
    let Some(db) = database() else { return };
    let publication = indexed(&db, b"published catalogue");
    db.store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.ready_publication(publication.id, Changes::NoComparison)?);
            Ok(())
        }))
        .unwrap();

    let refused = db.store.transaction(&mut Callback(&mut |queries| {
        queries.delete_publication_files(publication.id)
    }));
    assert!(matches!(refused, Err(Error::Internal(_))));
    assert_eq!(files(&db, &publication), 1);

    db.store
        .transaction(&mut Callback(&mut |queries| {
            assert!(queries.expire_publication(publication.id, Utc::now())?);
            queries.delete_publication_files(publication.id)
        }))
        .unwrap();
    assert_eq!(files(&db, &publication), 0);
}

#[test]
fn unfinished_and_failed_uploads_release_their_file_lists() {
    let Some(db) = database() else { return };
    let unfinished = indexed(&db, b"unfinished upload");
    let failed = indexed(&db, b"failed upload");
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.delete_publication_files(unfinished.id)?;
            assert!(queries.fail_publication(failed.id, PublicationFailure::Superseded)?);
            queries.delete_publication_files(failed.id)
        }))
        .unwrap();
    assert_eq!(files(&db, &unfinished), 0);
    assert_eq!(files(&db, &failed), 0);
}
