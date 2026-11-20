//! A fake consumer drives real plan, blob and completion services with the minted grant.

use std::collections::BTreeMap;
use std::io::Cursor;
use std::process::Command;
use std::sync::Arc;

use mkc_build_interface::request::BuildRequest;
use mkc_domain::ids::PublicationId;
use mkc_mokly_contract::archive::GzipTarReader;
use mkc_mokly_contract::bundle::ContractValidator;
use mkc_mokly_contract::limits::Limits;
use mkc_publications::blob_writer::ParallelBlobWriter;
use mkc_publications::ingest::{Ingest, PublicationIngest};
use mkc_publications::policy::DatabaseAccessPolicy;
use mkc_store_interface::build_state::UploadOutcome;
use mkc_upload_memory::budget::ProcessUploadMemoryBudget;
use serde::Deserialize;
use tempfile::TempDir;

use super::fixtures::Fixture;

#[derive(Deserialize)]
struct Catalogue {
    plan: Vec<u8>,
    blobs: BTreeMap<String, Vec<u8>>,
}

pub(super) trait BuildUpload: Send + Sync {
    fn commit(&self, request: &BuildRequest) -> PublicationId;
    fn reject(&self, request: &BuildRequest);
    fn begin(&self, request: &BuildRequest) -> PublicationId;
}

pub(super) struct UploadExchange {
    ingest: Arc<dyn Ingest>,
    _root: Arc<TempDir>,
}

impl UploadExchange {
    pub(super) fn create(fixture: &Fixture) -> Arc<dyn BuildUpload> {
        let root = fixture.file_root.clone();
        let files = fixture.files.clone();
        let ingest = Arc::new(PublicationIngest {
            transactions: fixture.transactions.clone(),
            runtime: fixture.runtime.clone(),
            policy: Arc::new(DatabaseAccessPolicy),
            validator: Arc::new(ContractValidator {
                reader: Arc::new(GzipTarReader::new(Arc::new(
                    ProcessUploadMemoryBudget::new(536_870_912),
                ))),
                limits: Limits::default(),
            }),
            writer: Arc::new(ParallelBlobWriter {
                files: files.clone(),
                transactions: fixture.transactions.clone(),
                runtime: fixture.runtime.clone(),
                worker_count: 4,
            }),
            files,
        });
        Arc::new(Self {
            ingest,
            _root: root,
        })
    }
}

impl BuildUpload for UploadExchange {
    fn commit(&self, request: &BuildRequest) -> PublicationId {
        let catalogue = catalogue(request);
        let bearer = request.upload_token.expose();
        let project = request.project_id;
        let plan = self
            .ingest
            .preflight(
                self.ingest.authorize(project, bearer).unwrap(),
                &mut Cursor::new(catalogue.plan),
            )
            .unwrap();
        for hash in &plan.missing {
            let authorization = self.ingest.authorize(project, bearer).unwrap();
            let target = self
                .ingest
                .blob_target(&authorization, plan.upload, Some(hash))
                .unwrap();
            self.ingest
                .store_blob(&target, catalogue.blobs[&hash.to_string()].clone().into())
                .unwrap();
        }
        let receipt = self
            .ingest
            .complete(
                self.ingest
                    .authorize_completion(project, bearer, plan.upload)
                    .unwrap(),
                plan.upload,
            )
            .unwrap();
        self.ingest
            .record_upload_outcome(project, bearer, UploadOutcome::Accepted)
            .unwrap();
        assert!(!receipt.replay);
        assert_eq!(receipt.publication.build_id, Some(request.build_id.into()));
        receipt.publication.id
    }

    fn begin(&self, request: &BuildRequest) -> PublicationId {
        let catalogue = catalogue(request);
        self.ingest
            .preflight(
                self.ingest
                    .authorize(request.project_id, request.upload_token.expose())
                    .unwrap(),
                &mut Cursor::new(catalogue.plan),
            )
            .unwrap()
            .upload
    }

    fn reject(&self, request: &BuildRequest) {
        let bearer = request.upload_token.expose();
        let authorization = self.ingest.authorize(request.project_id, bearer).unwrap();
        let error = self
            .ingest
            .preflight(authorization, &mut Cursor::new(b"invalid gzip"))
            .unwrap_err();
        assert!(matches!(
            error,
            mkc_publications::error::Error::InvalidBundle { .. }
        ));
        self.ingest
            .record_upload_outcome(request.project_id, bearer, UploadOutcome::Rejected)
            .unwrap();
    }
}

fn catalogue(request: &BuildRequest) -> Catalogue {
    let output = Command::new("python3")
        .arg(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../mkc-api/tests/github/upload_fixture.py"
        ))
        .args([
            request.repository.as_str(),
            request.head_sha.as_str(),
            request.branch.as_str(),
            request.config_path.as_str(),
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let catalogue: Catalogue = serde_json::from_slice(&output.stdout).unwrap();
    catalogue
}
