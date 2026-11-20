//! Live build-grant authorization, upload scoping and atomic ready consumption.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::build::Build;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::{BuildState, UploadOutcome};
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::store::Queries;

use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::PublicationIngest;
use crate::upload_authorization::{AuthorizedUpload, Credential};

pub(crate) trait BuildAuthorization {
    fn check_build(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        digest: &[u8; 32],
        completion: Option<PublicationId>,
        at: DateTime<Utc>,
    ) -> Result<AuthorizedUpload>;
    fn record_outcome(
        &self,
        project: ProjectId,
        bearer: &str,
        outcome: UploadOutcome,
    ) -> Result<()>;
}

impl BuildAuthorization for PublicationIngest {
    fn check_build(
        &self,
        queries: &mut dyn Queries,
        project: ProjectId,
        digest: &[u8; 32],
        completion: Option<PublicationId>,
        at: DateTime<Utc>,
    ) -> Result<AuthorizedUpload> {
        let grant = queries
            .build_grant(digest)
            .context("resolve build upload grant")?
            .ok_or(Error::Unauthorized)?;
        let build = queries
            .build_by_id(grant.build_id)
            .context("read upload build")?
            .ok_or(Error::Unauthorized)?;
        if build.project_id != project {
            return Err(Error::Forbidden);
        }
        if grant.consumed_at.is_some() {
            let replay = match completion {
                Some(id) if build.publication_id == Some(id) => queries
                    .publication(id)
                    .context("read consumed grant completion")?
                    .is_some_and(|upload| {
                        owns(&grant, &build, &upload)
                            && matches!(
                                upload.state,
                                PublicationState::Ready | PublicationState::Expired
                            )
                    }),
                _ => false,
            };
            if !replay {
                return Err(Error::Unauthorized);
            }
        } else if grant.expires_at <= at
            || build.state != BuildState::Running
            || build.attempt != grant.attempt
            || build.lease_expires_at.is_none_or(|until| until <= at)
            || build.deadline_at.is_none_or(|until| until <= at)
        {
            return Err(Error::Unauthorized);
        }
        let project = queries
            .project(project)
            .context("read build upload project")?
            .ok_or(Error::Unauthorized)?;
        let organization = queries
            .organization(project.organization_id)
            .context("read build upload organization plan")?
            .ok_or(Error::Unauthorized)?;
        if !organization.plan.allows_publication(project.visibility) {
            return Err(Error::PlanRequired);
        }
        Ok(AuthorizedUpload {
            project,
            token: None,
            build: Some((grant, build)),
        })
    }

    fn record_outcome(
        &self,
        project: ProjectId,
        bearer: &str,
        outcome: UploadOutcome,
    ) -> Result<()> {
        let Ok(Credential::Build(digest)) = Credential::parse(bearer) else {
            return Ok(());
        };
        self.transactions.run(false, &mut |queries| {
            let Some(grant) = queries
                .build_grant(&digest)
                .context("resolve answered upload grant")?
            else {
                return Ok(());
            };
            if queries
                .build(project, grant.build_id)
                .context("scope answered upload grant")?
                .is_some()
            {
                queries
                    .record_build_upload_outcome(grant.id, outcome)
                    .context("record answered build upload outcome")?;
            }
            Ok(())
        })
    }
}

/// Admission time binds a publication to its grant without an in-memory exchange ledger.
fn owns(grant: &BuildUploadGrant, build: &Build, upload: &Publication) -> bool {
    upload.project_id == build.project_id
        && upload.build_id == Some(build.id)
        && upload.created_at >= grant.created_at
        && upload.created_at < grant.expires_at
        && build.attempt == grant.attempt
}

impl AuthorizedUpload {
    pub(crate) fn scope(&self, upload: &Publication) -> Result<()> {
        if let Some((grant, build)) = &self.build
            && !owns(grant, build, upload)
        {
            return Err(Error::NotFound);
        }
        Ok(())
    }
}
