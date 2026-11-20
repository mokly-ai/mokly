//! Organization, project, publication and blob records shared by store tests.

use chrono::{Duration, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::ProjectId;
use mkc_domain::values::{Plan, Visibility};
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::store::Callback;
use uuid::Uuid;

use super::fixtures::Database;

pub(super) fn blob(project_id: ProjectId, bytes: &[u8]) -> Blob {
    Blob {
        project_id,
        key: BlobKey {
            hash: BlobHash::digest(bytes),
            incarnation: Uuid::now_v7(),
        },
        size: bytes.len() as i64,
        content_type: "application/octet-stream".into(),
        ref_count: 0,
        deleting: false,
        unreferenced_at: Some(Utc::now()),
        stored_at: None,
    }
}

pub(super) fn validating_publication(db: &Database) -> Publication {
    let now = Utc::now();
    let organization = Organization {
        id: Uuid::now_v7().into(),
        name: "Blob durability".into(),
        slug: format!("o-{}", Uuid::now_v7().simple()).parse().unwrap(),
        version: 1,
        created_at: now,
        plan: Plan::Free,
    };
    let project = Project {
        id: Uuid::now_v7().into(),
        organization_id: organization.id,
        name: "Blob durability".into(),
        slug: format!("p-{}", Uuid::now_v7().simple()).parse().unwrap(),
        repository: "mokly-ai/mokly-cloud".into(),
        config_path: "mokly.config.ts".into(),
        visibility: Visibility::Private,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    };
    let publication = Publication {
        id: Uuid::now_v7().into(),
        project_id: project.id,
        metadata: Some(PublicationMetadata {
            branch: "durability".into(),
            head_sha: "a".repeat(40),
            base_ref: None,
            base_sha: None,
            pull_request: None,
            config_path: project.config_path.clone(),
            exported_at: now,
        }),
        state: PublicationState::Validating,
        failure: None,
        changes: None,
        created_at: now,
        deadline: now + Duration::minutes(15),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    };
    db.store
        .transaction(&mut Callback(&mut |queries| {
            queries.insert_organization(&organization)?;
            queries.insert_project(&project)?;
            queries.insert_publication(&publication)
        }))
        .unwrap();
    publication
}

pub(super) fn file(publication: &Publication, path: &str, blob: &Blob) -> PublicationFile {
    PublicationFile {
        publication_id: publication.id,
        project_id: publication.project_id,
        path: path.into(),
        key: blob.key.clone(),
        content_type: blob.content_type.clone(),
        size: blob.size,
    }
}
