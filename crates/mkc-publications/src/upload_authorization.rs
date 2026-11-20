//! Digest-only upload credentials and transaction-local authorization results.

use chrono::{DateTime, Utc};
use mkc_auth::runtime::hash;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::build::Build;
use mkc_store_interface::build_clock::BuildClock;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::project::Project;
use mkc_store_interface::store::Queries;
use mkc_store_interface::token::Token;
use sha2::{Digest, Sha256};

use crate::build_upload::BuildAuthorization;
use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{PublicationIngest, UploadAuthorization};

/// A digest whose variant selects the persistent credential authority.
#[derive(Clone)]
pub(crate) enum Credential {
    Project(String),
    Build([u8; 32]),
}

impl Credential {
    pub(crate) fn parse(bearer: &str) -> Result<Self> {
        let secret = bearer
            .strip_prefix("mkc_")
            .or_else(|| bearer.strip_prefix("mkb_"))
            .ok_or(Error::Unauthorized)?;
        if secret.len() != 64
            || !secret
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(Error::Unauthorized);
        }
        if bearer.starts_with("mkb_") {
            Ok(Self::Build(Sha256::digest(bearer.as_bytes()).into()))
        } else {
            Ok(Self::Project(hash(bearer)))
        }
    }
}

/// Fresh database state for this transaction; never reused to authorize a request.
pub(crate) struct AuthorizedUpload {
    pub(crate) project: Project,
    pub(crate) token: Option<Token>,
    pub(crate) build: Option<(BuildUploadGrant, Build)>,
}

pub(crate) trait UploadPolicy {
    fn authenticate(
        &self,
        project: ProjectId,
        bearer: &str,
        completion: Option<PublicationId>,
    ) -> Result<UploadAuthorization>;
    fn check(
        &self,
        queries: &mut dyn Queries,
        authorization: &UploadAuthorization,
        completion: Option<PublicationId>,
        at: DateTime<Utc>,
    ) -> Result<AuthorizedUpload>;
}

impl UploadPolicy for PublicationIngest {
    fn authenticate(
        &self,
        project: ProjectId,
        bearer: &str,
        completion: Option<PublicationId>,
    ) -> Result<UploadAuthorization> {
        let credential = Credential::parse(bearer)?;
        let at = self.runtime.now();
        let mut authorization = None;
        self.transactions.run(true, &mut |queries| {
            let authorized = match &credential {
                Credential::Project(digest) => {
                    let (project, token) = self.policy.token(queries, project, digest)?;
                    AuthorizedUpload {
                        project,
                        token: Some(token),
                        build: None,
                    }
                }
                Credential::Build(digest) => {
                    self.check_build(queries, project, digest, completion, at)?
                }
            };
            let organization = queries
                .organization(authorized.project.organization_id)
                .context("read bearer organization slug")?
                .ok_or(Error::Unauthorized)?;
            authorization = Some(UploadAuthorization {
                project,
                credential: credential.clone(),
                organization_slug: organization.slug,
                project_slug: authorized.project.slug,
                build_id: authorized.build.map(|(_, build)| build.id),
            });
            Ok(())
        })?;
        authorization.ok_or(Error::Unauthorized)
    }

    fn check(
        &self,
        queries: &mut dyn Queries,
        authorization: &UploadAuthorization,
        completion: Option<PublicationId>,
        at: DateTime<Utc>,
    ) -> Result<AuthorizedUpload> {
        match &authorization.credential {
            Credential::Project(digest) => {
                let (project, token) = self.policy.token(queries, authorization.project, digest)?;
                Ok(AuthorizedUpload {
                    project,
                    token: Some(token),
                    build: None,
                })
            }
            Credential::Build(digest) => {
                self.check_build(queries, authorization.project, digest, completion, at)
            }
        }
    }
}

/// Credential writes that belong to the caller's publication transaction.
pub(crate) trait UploadCommit {
    fn touch_token(&mut self, queries: &mut dyn Queries, at: DateTime<Utc>) -> Result<()>;
    fn consume(
        &self,
        queries: &mut dyn Queries,
        publication: PublicationId,
        clock: &dyn BuildClock,
    ) -> Result<()>;
}

impl UploadCommit for AuthorizedUpload {
    fn touch_token(&mut self, queries: &mut dyn Queries, at: DateTime<Utc>) -> Result<()> {
        if let Some(token) = &mut self.token {
            token.last_used_at = Some(at);
            queries
                .save_token(token)
                .context("touch successfully used publishing token")?;
        }
        Ok(())
    }

    /// Consume only here, in the caller's publication-ready transaction.
    fn consume(
        &self,
        queries: &mut dyn Queries,
        publication: PublicationId,
        clock: &dyn BuildClock,
    ) -> Result<()> {
        if let Some((grant, _)) = &self.build
            && grant.consumed_at.is_none()
            && !queries
                .consume_build_grant(grant.id, publication, clock)
                .context("consume ready build upload grant")?
        {
            return Err(Error::Unauthorized);
        }
        Ok(())
    }
}
