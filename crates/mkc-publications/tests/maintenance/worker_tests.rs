//! Real cleanup preserves historical check behavior and fences later reuse.

use std::sync::Arc;

use bytes::Bytes;
use chrono::{Duration, Utc};
use mkc_auth::runtime::RuntimeMock;
use mkc_file_store_interface::deadline::{MAX_OPERATION_DURATION, OperationDeadline};
use mkc_file_store_local::directory::{FileStoreFactory, LocalFileStoreFactory};
use mkc_github_interface::check::{CheckRunsMock, Conclusion};
use mkc_publications::check_worker::{ChecksWorker, PublicationChecks};
use mkc_publications::garbage_collection::{BlobGarbageCollector, GarbageCollector};
use mkc_publications::locations::Locations;
use mkc_publications::retention::{PublicationRetention, RetentionWorker};
use mkc_publications::transaction::StoreTransactions;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::Callback;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::fixtures::{blob, file, project, publication, store};

fn operation_deadline() -> OperationDeadline {
    OperationDeadline::new(MAX_OPERATION_DURATION)
}

#[test]
fn historical_expiry_keeps_rerequests_and_collects_released_and_orphan_objects() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let old = publication(&project, PublicationState::Validating, 0, "feature");
    let latest = publication(&project, PublicationState::Validating, 0, "feature");
    let default = publication(&project, PublicationState::Validating, 0, "main");
    let mut pull = publication(&project, PublicationState::Validating, 0, "pull");
    pull.metadata.as_mut().unwrap().pull_request = Some(17);
    let abandoned = publication(&project, PublicationState::Uploading, 0, "abandoned");
    let old_blob = blob(project.id, b"expired bytes");
    let retained_blob = blob(project.id, b"retained bytes");
    let orphan = blob(project.id, b"unindexed bytes");
    let directory = tempfile::tempdir().unwrap();
    let files = LocalFileStoreFactory.open(directory.path()).unwrap();
    files
        .put(
            &old_blob.key,
            Bytes::from_static(b"expired bytes"),
            operation_deadline(),
        )
        .unwrap();
    files
        .put(
            &retained_blob.key,
            Bytes::from_static(b"retained bytes"),
            operation_deadline(),
        )
        .unwrap();
    files
        .put(
            &orphan.key,
            Bytes::from_static(b"unindexed bytes"),
            operation_deadline(),
        )
        .unwrap();
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_blob(&old_blob)?;
            q.insert_blob(&retained_blob)?;
            for value in [&old, &latest, &default, &pull] {
                q.insert_publication(value)?;
                let reference = file(
                    project.id,
                    value.id,
                    if value.id == old.id {
                        old_blob.key.clone()
                    } else {
                        retained_blob.key.clone()
                    },
                );
                q.insert_publication_file(&reference)?;
                assert!(q.ready_publication(value.id, Changes::NoComparison)?);
            }
            q.insert_publication(&abandoned)?;
            assert!(q.expire_publication(old.id, Utc::now())?);
            q.delete_publication_files(old.id)?;
            q.insert_publication_event(&PublicationEvent {
                id: Uuid::now_v7(),
                publication_id: old.id,
                kind: EventKind::Expired,
                created_at: Utc::now(),
            })
        }))
        .unwrap();
    let now = Utc::now() + Duration::days(31);
    let runtime = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now),
        RuntimeMock::id
            .each_call(matching!())
            .answers(&|_| Uuid::now_v7()),
    )));
    let transactions = Arc::new(StoreTransactions {
        store: store.clone(),
    });
    let worker = PublicationRetention {
        transactions: transactions.clone(),
        runtime,
    };
    let report = worker.run_batch(None).unwrap();
    assert_eq!((report.abandoned, report.pruned), (1, 0));
    store
        .read(&mut Callback(&mut |q| {
            assert!(q.publication(old.id)?.unwrap().expired_at.is_some());
            assert_eq!(
                q.publication(old.id)?.unwrap().state,
                PublicationState::Expired
            );
            assert!(q.publication_files(old.id)?.is_empty());
            assert_eq!(
                q.blob(project.id, &old_blob.key.hash)?.unwrap().ref_count,
                0
            );
            assert_eq!(
                q.blob(project.id, &retained_blob.key.hash)?
                    .unwrap()
                    .ref_count,
                3
            );
            assert_eq!(
                q.latest_publication(project.id, "feature")?.unwrap().id,
                latest.id
            );
            Ok(())
        }))
        .unwrap();
    let checks: &dyn ChecksWorker = &PublicationChecks {
        transactions: transactions.clone(),
        files: Arc::new(Unimock::new(())),
        runtime: worker.runtime.clone(),
        locations: Locations {
            app_origin: "https://app.example.com".into(),
            catalogue_domain: "catalogues.example.net".into(),
            catalogue_scheme: "https".into(),
            catalogue_port: None,
        },
        github: Arc::new(Unimock::new(
            CheckRunsMock::upsert
                .next_call(matching!(_))
                .answers(&|_, check| {
                    assert_eq!(check.conclusion, Some(Conclusion::Neutral));
                    assert!(check.details_url.contains("/m-"));
                    assert!(!check.details_url.contains("/publications/"));
                    Ok(())
                }),
        )),
    };
    checks
        .rerequest(
            old.id,
            &project.repository,
            &old.metadata.as_ref().unwrap().head_sha,
        )
        .unwrap();
    assert!(checks.run_batch(None).unwrap() >= 1);
    let collector = BlobGarbageCollector {
        transactions,
        files: files.clone(),
        runtime: Arc::new(Unimock::new(
            RuntimeMock::now
                .each_call(matching!())
                .returns(now + Duration::days(1)),
        )),
    };
    let report = collector.run_batch(None).unwrap();
    assert_eq!((report.blobs, report.orphans), (1, 1));
    assert!(files.get(&old_blob.key).unwrap().is_none());
    assert!(files.get(&orphan.key).unwrap().is_none());
    assert_eq!(
        files.get(&retained_blob.key).unwrap().unwrap(),
        b"retained bytes"
    );
    store
        .transaction(&mut Callback(&mut |q| {
            assert!(q.blob(project.id, &old_blob.key.hash)?.is_none());
            q.delete_organization(project.organization_id)?;
            assert_eq!(
                q.blob(project.id, &retained_blob.key.hash)?
                    .unwrap()
                    .ref_count,
                0
            );
            Ok(())
        }))
        .unwrap();
    assert_eq!(collector.run_batch(None).unwrap().blobs, 1);
}
