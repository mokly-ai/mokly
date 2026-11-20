//! The complete runner keeps successful files and reclaims unreachable objects.

use std::sync::Arc;

use bytes::Bytes;
use chrono::{Duration, Utc};
use mkc_auth::runtime::RuntimeMock;
use mkc_file_store_interface::deadline::{MAX_OPERATION_DURATION, OperationDeadline};
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_mokly_contract::bundle::ENVELOPE_PATH;
use mkc_publications::garbage_collection::BlobGarbageCollector;
use mkc_publications::maintenance::{Maintenance, MaintenanceReport, PublicationMaintenance};
use mkc_publications::retention::PublicationRetention;
use mkc_publications::transaction::StoreTransactions;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::publication_event::CatalogueGrant;
use mkc_store_interface::store::Callback;
use mkc_store_interface::user::User;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::fixtures::{blob, file, project, publication, store};

#[test]
fn complete_runner_preserves_ready_history_until_parent_deletion() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let owner = project(store.as_ref());
    let other = project(store.as_ref());
    let old = publication(&owner, PublicationState::Validating, 0, "feature");
    let latest = publication(&owner, PublicationState::Validating, 0, "feature");
    let independent = publication(&other, PublicationState::Validating, 0, "feature");
    let abandoned = publication(&owner, PublicationState::Validating, 0, "unfinished");
    let failed = publication(&owner, PublicationState::Validating, 31, "failed");
    let retained = blob(owner.id, b"runner retained");
    let private = blob(owner.id, b"runner metadata");
    let separate = blob(other.id, b"runner retained");
    let released = blob(owner.id, b"runner abandoned");
    let unreferenced = blob(owner.id, b"runner unreferenced");
    let orphan = blob(owner.id, b"runner orphan");
    let directory = tempfile::tempdir().unwrap();
    let files = LocalFileStoreFactory.open(directory.path()).unwrap();
    for (object, bytes) in [
        (&retained, b"runner retained".as_slice()),
        (&private, b"runner metadata".as_slice()),
        (&separate, b"runner retained".as_slice()),
        (&released, b"runner abandoned".as_slice()),
        (&unreferenced, b"runner unreferenced".as_slice()),
        (&orphan, b"runner orphan".as_slice()),
    ] {
        files
            .put(
                &object.key,
                Bytes::copy_from_slice(bytes),
                OperationDeadline::new(MAX_OPERATION_DURATION),
            )
            .unwrap();
    }
    let at = Utc::now();
    let user = User {
        id: Uuid::now_v7().into(),
        email: "runner@example.com".into(),
        name: "Runner".into(),
        created_at: at,
    };
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_user(&user)?;
            for object in [&retained, &private, &separate, &released, &unreferenced] {
                q.insert_blob(object)?;
                assert!(q.mark_blob_stored(&object.key)?);
            }
            for (row, content) in [
                (&old, &retained),
                (&latest, &retained),
                (&independent, &separate),
                (&abandoned, &released),
            ] {
                q.insert_publication(row)?;
                let mut reference = file(row.project_id, row.id, content.key.clone());
                reference.size = content.size;
                q.insert_publication_file(&reference)?;
            }
            let mut metadata = file(owner.id, old.id, private.key.clone());
            metadata.path = ENVELOPE_PATH.into();
            metadata.size = private.size;
            q.insert_publication_file(&metadata)?;
            for row in [&old, &latest, &independent] {
                assert!(q.ready_publication(row.id, Changes::NoComparison)?);
            }
            q.insert_publication(&failed)?;
            assert!(q.fail_publication(failed.id, PublicationFailure::Internal)?);
            for (digest, age) in [("a".repeat(64), 1), ("b".repeat(64), 40)] {
                q.insert_catalogue_grant(&CatalogueGrant {
                    digest,
                    publication_id: old.id,
                    user_id: user.id,
                    expires_at: at + Duration::days(age),
                })?;
            }
            Ok(())
        }))
        .unwrap();
    let now = at + Duration::days(31);
    let runtime = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now),
        RuntimeMock::id
            .each_call(matching!())
            .answers(&|_| Uuid::now_v7()),
    )));
    let transactions = Arc::new(StoreTransactions {
        store: store.clone(),
    });
    let maintenance: &dyn PublicationMaintenance = &Maintenance {
        retention: Arc::new(PublicationRetention {
            transactions: transactions.clone(),
            runtime: runtime.clone(),
        }),
        garbage: Arc::new(BlobGarbageCollector {
            transactions,
            files: files.clone(),
            runtime,
        }),
    };
    assert_eq!(
        maintenance.run().unwrap(),
        MaintenanceReport {
            abandoned: 1,
            pruned: 1,
            blobs: 2,
            orphans: 1,
        }
    );
    store
        .transaction(&mut Callback(&mut |q| {
            for row in [&old, &latest, &independent] {
                let kept = q.publication(row.id)?.unwrap();
                assert_eq!(
                    (kept.state, kept.expired_at),
                    (PublicationState::Ready, None)
                );
            }
            assert_eq!(q.publication_files(old.id)?.len(), 2);
            assert_eq!(q.blob(owner.id, &retained.key.hash)?.unwrap().ref_count, 2);
            assert_eq!(q.blob(owner.id, &private.key.hash)?.unwrap().ref_count, 1);
            assert_eq!(q.blob(other.id, &separate.key.hash)?.unwrap().ref_count, 1);
            let identity = old.metadata.as_ref().unwrap();
            assert_eq!(
                q.publication_by_identity(owner.id, &identity.head_sha, &identity.config_path)?
                    .unwrap()
                    .id,
                old.id
            );
            assert_eq!(
                q.latest_publication(owner.id, "feature")?.unwrap().id,
                latest.id
            );
            assert!(q.publication(failed.id)?.is_none());
            let closed = q.publication(abandoned.id)?.unwrap();
            assert_eq!(
                (closed.state, closed.failure),
                (PublicationState::Failed, Some(PublicationFailure::Expired))
            );
            assert!(q.publication_files(abandoned.id)?.is_empty());
            assert!(
                q.consume_catalogue_grant(&"a".repeat(64), old.id, at)?
                    .is_none()
            );
            assert_eq!(
                q.consume_catalogue_grant(&"b".repeat(64), old.id, now)?
                    .unwrap()
                    .publication_id,
                old.id
            );
            Ok(())
        }))
        .unwrap();
    for object in [&released, &unreferenced, &orphan] {
        assert!(files.get(&object.key).unwrap().is_none());
    }
    assert_eq!(
        files.get(&retained.key).unwrap().unwrap(),
        b"runner retained"
    );
    assert_eq!(
        files.get(&private.key).unwrap().unwrap(),
        b"runner metadata"
    );
    assert_eq!(
        files.get(&separate.key).unwrap().unwrap(),
        b"runner retained"
    );
    store
        .transaction(&mut Callback(&mut |q| q.delete_project(owner.id)))
        .unwrap();
    assert_eq!(maintenance.run().unwrap().blobs, 2);
    assert!(files.get(&retained.key).unwrap().is_none());
    assert!(files.get(&private.key).unwrap().is_none());
    assert_eq!(
        files.get(&separate.key).unwrap().unwrap(),
        b"runner retained"
    );
    store
        .read(&mut Callback(&mut |q| {
            assert!(q.publications(owner.id)?.is_empty());
            assert_eq!(q.blob(other.id, &separate.key.hash)?.unwrap().ref_count, 1);
            Ok(())
        }))
        .unwrap();
}
