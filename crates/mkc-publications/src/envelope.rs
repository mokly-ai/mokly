//! Shared envelope authorization and identity retention for rejected uploads.

use chrono::DateTime;
use mkc_domain::repository::RepositoryIdentity;
use mkc_mokly_contract::manifest::UploadManifest;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationMetadata};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};

use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{PublicationIngest, UploadAuthorization};
use crate::upload_authorization::{AuthorizedUpload, UploadPolicy};

pub(crate) fn authorize(project: &Project, manifest: &UploadManifest) -> Result<()> {
    let repository = &manifest.repository;
    let identity =
        RepositoryIdentity::from_parts(&repository.host, &repository.owner, &repository.name)
            .ok_or(Error::Forbidden)?;
    if !project
        .repository
        .eq_ignore_ascii_case(&identity.canonical())
        || project.config_path != manifest.config_path
    {
        return Err(Error::Forbidden);
    }
    Ok(())
}

pub(crate) fn metadata(manifest: &UploadManifest) -> Result<PublicationMetadata> {
    Ok(PublicationMetadata {
        branch: manifest.branch.clone(),
        head_sha: manifest.head_sha.clone(),
        base_ref: manifest.base_ref.clone(),
        base_sha: manifest.base_sha.clone(),
        pull_request: manifest.pull_request.map(|number| number as i64),
        config_path: manifest.config_path.clone(),
        exported_at: DateTime::parse_from_rfc3339(&manifest.exported_at)
            .context("decode validated export timestamp")?
            .to_utc(),
    })
}

impl AuthorizedUpload {
    /// Validate identity before retaining it, and use the build's PR context.
    pub(crate) fn metadata(&self, manifest: &UploadManifest) -> Result<PublicationMetadata> {
        authorize(&self.project, manifest)?;
        let mut metadata = metadata(manifest)?;
        if let Some((_, build)) = &self.build {
            if manifest.head_sha != build.head_sha
                || manifest.branch != build.branch
                || manifest
                    .pull_request
                    .is_some_and(|number| Some(number as i64) != build.pull_request)
                || manifest.config_path != build.config_path
            {
                return Err(Error::Forbidden);
            }
            metadata.pull_request = build.pull_request;
        }
        Ok(metadata)
    }
}

pub(crate) trait RejectedIdentity {
    fn retain_identity(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        manifest: &UploadManifest,
    ) -> Result<()>;
}

impl RejectedIdentity for PublicationIngest {
    fn retain_identity(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        manifest: &UploadManifest,
    ) -> Result<()> {
        let at = self.runtime.now();
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: attempt.id,
            kind: EventKind::Validating,
            created_at: self.runtime.now(),
        };
        self.transactions.run(false, &mut |queries| {
            let authorized = self.check(queries, authorization, None, at)?;
            let metadata = authorized.metadata(manifest)?;
            if queries
                .validate_publication(attempt.id, &metadata)
                .context("retain authorized rejected-upload identity")?
            {
                queries
                    .insert_publication_event(&event)
                    .context("record authorized rejected envelope")?;
            }
            Ok(())
        })
    }
}
