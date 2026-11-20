//! A real admitted comparison, durable reference, build and upload grant.

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_file_store_interface::store::FileStoreMock;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_mokly_contract::limits::Limits;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_publications::ingest::{Ingest, PublicationIngest, UploadAuthorization};
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_attempt::BuildAttempt;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::BuildTrigger;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use sha2::{Digest, Sha256};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::super::fixtures::Fixture;

pub(super) const INDEX_BYTES: &[u8] = include_bytes!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../mkc-mokly-contract/fixtures/index-v9.json"
));

pub(super) struct Upload {
    pub(super) fixture: Fixture,
    pub(super) ingest: Arc<dyn Ingest>,
    pub(super) authorization: UploadAuthorization,
    pub(super) build: NewBuild,
    pub(super) attempt: BuildAttempt,
    pub(super) grant: BuildUploadGrant,
    pub(super) publication: Publication,
    pub(super) blob: Blob,
}

impl Upload {
    pub(super) fn create() -> Option<Self> {
        let f = Fixture::create()?;
        let manifest = UploadManifest::parse(
            include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../mkc-mokly-contract/fixtures/mokly-upload.json"
            )),
            Limits::default(),
        )
        .unwrap();
        let now = Utc::now();
        let build = NewBuild {
            id: Uuid::now_v7().into(),
            project_id: f.project.id,
            repository_id: f.repository.id,
            trigger: BuildTrigger::Request,
            branch: manifest.branch.clone(),
            head_sha: manifest.head_sha.clone(),
            pull_request: None,
            base_ref: manifest.base_ref.clone(),
            config_path: f.project.config_path.clone(),
            created_at: now,
        };
        let attempt = BuildAttempt {
            now,
            operation_id: Uuid::now_v7(),
            lease_token: Uuid::now_v7(),
            lease_expires_at: now + Duration::minutes(2),
            deadline_at: now + Duration::minutes(15),
        };
        let bearer = format!("mkb_{}", "a".repeat(64));
        let grant = BuildUploadGrant {
            id: Uuid::now_v7(),
            build_id: build.id,
            attempt: 1,
            token_digest: Sha256::digest(bearer.as_bytes()).into(),
            expires_at: attempt.deadline_at,
            consumed_at: None,
            outcome: None,
            created_at: now,
        };
        let path = INDEX_PATH;
        let publication = Publication {
            id: Uuid::now_v7().into(),
            project_id: f.project.id,
            build_id: Some(build.id),
            build_failure_event_id: Some(Uuid::now_v7()),
            metadata: Some(PublicationMetadata {
                branch: build.branch.clone(),
                head_sha: build.head_sha.clone(),
                base_ref: manifest.base_ref.clone(),
                base_sha: manifest.base_sha.clone(),
                pull_request: None,
                config_path: build.config_path.clone(),
                exported_at: DateTime::parse_from_rfc3339(&manifest.exported_at)
                    .unwrap()
                    .to_utc(),
            }),
            state: PublicationState::Validating,
            failure: None,
            changes: None,
            created_at: now,
            deadline: attempt.deadline_at,
            expired_at: None,
        };
        let blob = Blob {
            project_id: f.project.id,
            key: BlobKey {
                hash: BlobHash::digest(INDEX_BYTES),
                incarnation: Uuid::now_v7(),
            },
            size: INDEX_BYTES.len() as i64,
            content_type: "application/json".into(),
            ref_count: 0,
            deleting: false,
            unreferenced_at: Some(now),
            stored_at: None,
        };
        f.queries(&mut |q| {
            q.schedule_build(&build).unwrap();
            q.start_build(build.id, &attempt).unwrap().unwrap();
            assert!(q.mint_build_grant(&grant).unwrap());
            q.insert_publication(&publication).unwrap();
            q.insert_blob(&blob).unwrap();
            q.insert_publication_file(&PublicationFile {
                publication_id: publication.id,
                project_id: f.project.id,
                path: path.into(),
                key: blob.key.clone(),
                size: blob.size,
                content_type: blob.content_type.clone(),
            })
            .unwrap();
            assert!(q.mark_blob_stored(&blob.key).unwrap());
        });
        let empty = Arc::new(Unimock::new(()));
        let ingest: Arc<dyn Ingest> = Arc::new(PublicationIngest {
            transactions: f.transactions.clone(),
            runtime: f.runtime.clone(),
            policy: Arc::new(DatabaseAccessPolicy),
            validator: empty.clone(),
            writer: empty,
            files: Arc::new(Unimock::new(
                FileStoreMock::get
                    .each_call(matching!(_))
                    .answers(&|_, _| Ok(Some(INDEX_BYTES.to_vec()))),
            )),
        });
        let authorization = ingest
            .authorize_completion(f.project.id, &bearer, publication.id)
            .unwrap();
        Some(Self {
            fixture: f,
            ingest,
            authorization,
            build,
            attempt,
            grant,
            publication,
            blob,
        })
    }
}
