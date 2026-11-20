//! Pure viewer test fixtures and reusable query expectations.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId, UserId};
use mkc_domain::values::{Plan, Visibility};
use mkc_mokly_contract::index::{CatalogueIndex, INDEX_PATH};
use mkc_mokly_contract::limits::Limits;
use mkc_publications::locations::Locations;
use mkc_store_interface::blob::PublicationFile;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::publication_changes::{Changes, Counts};
use mkc_store_interface::viewer::ViewerPublication;
use uuid::Uuid;

pub(super) const PROJECT: ProjectId = ProjectId(Uuid::from_u128(1));
pub(super) const PUBLICATION: PublicationId = PublicationId(Uuid::from_u128(2));
pub(super) const USER: UserId = UserId(Uuid::from_u128(3));
pub(super) const WORKSPACE: OrganizationId = OrganizationId(Uuid::from_u128(4));

pub(super) fn now() -> DateTime<Utc> {
    DateTime::from_timestamp(1_700_000_000, 0).unwrap()
}

pub(super) fn project(visibility: Visibility) -> Project {
    Project {
        id: PROJECT,
        organization_id: WORKSPACE,
        name: "Project".into(),
        slug: "project".parse().unwrap(),
        repository: "mokly-ai/mokly-cloud".into(),
        config_path: "mokly.config.json".into(),
        visibility,
        require_approval: false,
        automatic_builds: false,
        version: 1,
    }
}

pub(super) fn workspace() -> Organization {
    Organization {
        id: WORKSPACE,
        name: "Mokly".into(),
        slug: "mokly".parse().unwrap(),
        version: 1,
        created_at: now(),
        plan: Plan::Free,
    }
}

pub(super) fn publication(comparison: bool) -> Publication {
    Publication {
        id: PUBLICATION,
        project_id: PROJECT,
        metadata: Some(PublicationMetadata {
            branch: "main".into(),
            head_sha: "a".repeat(40),
            base_ref: comparison.then(|| index().base().unwrap().into()),
            base_sha: comparison.then(|| index().base_commit().unwrap().into()),
            pull_request: None,
            config_path: "mokly.config.json".into(),
            exported_at: now(),
        }),
        state: PublicationState::Ready,
        failure: None,
        changes: Some(if comparison {
            Changes::Available(Counts::default())
        } else {
            Changes::NoComparison
        }),
        created_at: now(),
        deadline: now() + Duration::hours(1),
        expired_at: None,
        build_id: None,
        build_failure_event_id: None,
    }
}

pub(super) fn viewer_publication(comparison: bool) -> ViewerPublication {
    ViewerPublication {
        publication: publication(comparison),
        pull_request: None,
    }
}

pub(super) fn file() -> PublicationFile {
    PublicationFile {
        publication_id: PUBLICATION,
        project_id: PROJECT,
        path: INDEX_PATH.into(),
        key: BlobKey {
            hash: BlobHash::digest(b"index"),
            incarnation: Uuid::from_u128(5),
        },
        content_type: "application/json".into(),
        size: 6,
    }
}

pub(super) fn locations() -> Locations {
    Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "br-main.preview.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    }
}

pub(super) fn index() -> CatalogueIndex {
    CatalogueIndex::parse(
        include_bytes!("../../../../mkc-mokly-contract/fixtures/index-v9.json"),
        Limits::default(),
    )
    .unwrap()
}
