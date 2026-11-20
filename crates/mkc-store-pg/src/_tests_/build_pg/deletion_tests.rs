//! Parent deletion through the same Store boundary that API services use.

use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::publication_changes::Changes;
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::grant_tests::grant;
use super::support::{attempt, finish, fixture};

fn delete_published_parent(organization: bool, expired: bool) {
    let Some(f) = fixture() else { return };
    let build = f.build("main", 1);
    f.schedule(&build);
    let a = attempt(f.now);
    let g = grant(build.id, &a);
    let mut p = f.publication(&build);
    p.state = PublicationState::Validating;
    p.changes = None;
    let blob = Blob {
        project_id: f.project.id,
        key: BlobKey {
            hash: BlobHash::digest(b"published"),
            incarnation: Uuid::now_v7(),
        },
        size: 9,
        content_type: "text/html".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(f.now),
        stored_at: None,
    };
    f.store
        .transaction(&mut Callback(&mut |q| {
            q.start_build(build.id, &a)?.unwrap();
            assert!(q.mint_build_grant(&g)?);
            q.insert_publication(&p)?;
            q.insert_blob(&blob)?;
            q.insert_publication_file(&PublicationFile {
                publication_id: p.id,
                project_id: f.project.id,
                path: "index.html".into(),
                key: blob.key.clone(),
                size: blob.size,
                content_type: blob.content_type.clone(),
            })?;
            assert!(q.mark_blob_stored(&blob.key)?);
            assert!(q.ready_publication(p.id, Changes::NoComparison)?);
            assert!(q.consume_build_grant(g.id, p.id, &|| f.now)?);
            assert!(q.finish_build(
                build.id,
                Some(a.lease_token),
                &finish(f.now, BuildState::Published)
            )?);
            if expired {
                assert!(q.expire_publication(p.id, f.now)?);
                q.delete_publication_files(p.id)?;
            }
            Ok(())
        }))
        .unwrap();
    f.store
        .transaction(&mut Callback(&mut |q| {
            if organization {
                q.delete_organization(f.project.organization_id)?;
            } else {
                q.delete_project(f.project.id)?;
            }
            Ok(())
        }))
        .unwrap();
    f.store
        .read(&mut Callback(&mut |q| {
            assert!(q.project(f.project.id)?.is_none());
            assert_eq!(
                q.organization(f.project.organization_id)?.is_none(),
                organization
            );
            assert!(q.build_by_id(build.id)?.is_none());
            assert!(q.build_grant(&g.token_digest)?.is_none());
            assert!(q.publication(p.id)?.is_none());
            assert!(q.publication_files(p.id)?.is_empty());
            assert_eq!(q.blob(f.project.id, &blob.key.hash)?.unwrap().ref_count, 0);
            Ok(())
        }))
        .unwrap();
}

#[test]
fn delete_project_with_a_published_build_and_ready_publication() {
    delete_published_parent(false, false);
}

#[test]
fn delete_project_with_a_published_build_and_expired_publication() {
    delete_published_parent(false, true);
}

#[test]
fn delete_organization_with_a_published_build_and_ready_publication() {
    delete_published_parent(true, false);
}

#[test]
fn delete_organization_with_a_published_build_and_expired_publication() {
    delete_published_parent(true, true);
}
