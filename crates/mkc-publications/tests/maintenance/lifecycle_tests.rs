//! SQL lifecycle constraints, idempotency and collection fencing.

use chrono::{Duration, Utc};
use mkc_domain::blob::BlobKey;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::{blob, file, project, publication, store};

#[test]
fn queries_enforce_monotonic_state_immutable_files_and_content_lifetimes() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let upload = publication(&project, PublicationState::Uploading, 0, "feature");
    let metadata = publication(&project, PublicationState::Ready, 0, "feature")
        .metadata
        .unwrap();
    let blob = blob(project.id, project.id.to_string().as_bytes());
    let mut file = file(project.id, upload.id, blob.key.clone());
    file.size = blob.size;
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&upload)?;
            assert!(!q.ready_publication(upload.id, Changes::NoComparison)?);
            assert!(q.validate_publication(upload.id, &metadata)?);
            assert!(!q.validate_publication(upload.id, &metadata)?);
            q.insert_blob(&blob)?;
            q.insert_publication_file(&file)?;
            assert_eq!(q.blob(project.id, &blob.key.hash)?.unwrap().ref_count, 1);
            assert!(!q.mark_blob_deleting(&blob.key)?);
            assert!(q.ready_publication(upload.id, Changes::NoComparison)?);
            assert!(!q.fail_publication(upload.id, PublicationFailure::Internal)?);
            assert_eq!(
                q.publication_by_identity(project.id, &metadata.head_sha, &metadata.config_path)?
                    .unwrap()
                    .id,
                upload.id
            );
            assert_eq!(q.publication_files(upload.id)?.len(), 1);
            q.insert_branch_alias(
                "b-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                project.id,
                "feature",
            )?;
            assert_eq!(
                q.branch_alias("b-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")?
                    .unwrap()
                    .id,
                upload.id
            );
            assert!(q.expire_publication(upload.id, Utc::now())?);
            q.delete_publication_files(upload.id)?;
            assert_eq!(q.blob(project.id, &blob.key.hash)?.unwrap().ref_count, 0);
            assert!(q.latest_publication(project.id, "feature")?.is_none());
            assert!(q.mark_blob_deleting(&blob.key)?);
            assert!(!q.delete_blob_record(&BlobKey {
                incarnation: Uuid::nil(),
                ..blob.key.clone()
            })?);
            assert!(q.delete_blob_record(&blob.key)?);
            q.delete_organization(project.organization_id)
        }))
        .unwrap();
}

#[test]
fn expired_attempts_cannot_commit_and_failed_history_can_be_pruned() {
    let Some((store, _schema)) = store() else {
        return;
    };
    let project = project(store.as_ref());
    let upload = publication(&project, PublicationState::Validating, 31, "feature");
    store
        .transaction(&mut Callback(&mut |q| {
            q.insert_publication(&upload)?;
            assert!(!q.ready_publication(upload.id, Changes::NoComparison)?);
            assert!(q.fail_publication(upload.id, PublicationFailure::Expired)?);
            assert!(!q.validate_publication(upload.id, upload.metadata.as_ref().unwrap())?);
            assert!(q.delete_failed_publication(upload.id, Utc::now() - Duration::days(30))?);
            assert!(q.publication(upload.id)?.is_none());
            q.delete_organization(project.organization_id)
        }))
        .unwrap();
}
