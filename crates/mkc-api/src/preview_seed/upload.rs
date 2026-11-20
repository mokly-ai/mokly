//! Replay the captured plan and only its missing blobs through the ingest service.

use std::io::Cursor;
use std::sync::Arc;

use bytes::Bytes;
use mkc_domain::ids::ProjectId;
use mkc_file_store_interface::seed::SeedStore;
use mkc_file_store_interface::seed_name::SeedName;
use mkc_publications::error;
use mkc_publications::error::ErrorResultExt;
use mkc_publications::ingest::{Ingest, Ingested};

use super::error::{Error, Failure, Result};

#[cfg_attr(test, unimock::unimock(api = CatalogueUploadMock))]
pub(super) trait CatalogueUpload: Send + Sync {
    fn publish(
        &self,
        run: &str,
        project: ProjectId,
        bearer: &str,
        archive: &[u8],
    ) -> Result<Ingested>;
}

pub(super) struct IngestCatalogueUpload {
    pub(super) files: Arc<dyn SeedStore>,
    pub(super) ingest: Arc<dyn Ingest>,
}

impl CatalogueUpload for IngestCatalogueUpload {
    fn publish(
        &self,
        run: &str,
        project: ProjectId,
        bearer: &str,
        archive: &[u8],
    ) -> Result<Ingested> {
        let first = self.attempt(run, project, bearer, archive);
        let result = match first {
            Err(error::Error::Expired) => {
                tracing::warn!(
                    step = "9 catalogue upload",
                    "upload attempt expired or superseded; start one fresh plan"
                );
                self.attempt(run, project, bearer, archive)
            }
            result => result,
        };
        match result {
            Ok(publication) => Ok(publication),
            Err(error) => Err(Error::internal_with(error, "upload seed catalogue")),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/upload_tests.rs"]
mod tests;

impl IngestCatalogueUpload {
    fn attempt(
        &self,
        run: &str,
        project: ProjectId,
        bearer: &str,
        archive: &[u8],
    ) -> error::Result<Ingested> {
        let authorization = self.ingest.authorize(project, bearer)?;
        let plan = self
            .ingest
            .preflight(authorization.clone(), &mut Cursor::new(archive))?;
        for hash in plan.missing {
            let target = self
                .ingest
                .blob_target(&authorization, plan.upload, Some(&hash))?;
            let name = SeedName::new(run, &format!("catalogue/blobs/{hash}"))
                .context("validate seed blob name")?;
            let bytes = self
                .files
                .get(&name, name.max_bytes())
                .context("read seed catalogue blob")?
                .ok_or_else(|| error::Error::internal(Failure::CatalogueMissing))?;
            self.ingest.store_blob(&target, Bytes::from(bytes))?;
        }
        self.ingest.complete(authorization, plan.upload)
    }
}
