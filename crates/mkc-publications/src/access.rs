//! One-use grant exchange and request-by-request catalogue authorization.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::{Runtime, hash};
use mkc_domain::ids::{ProjectId, PublicationId, UserId};
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_event::CatalogueGrant;

use crate::capability::{Capabilities, Capability};
use crate::error::{Error, ErrorResultExt, Result};
use crate::locations::Locations;
use crate::policy::AccessPolicy;
use crate::transaction::Transactions;

/// Credential issued once through the authenticated API; intentionally no Debug.
pub struct IssuedGrant {
    /// Opaque one-use secret, transported only in a JSON request body.
    pub grant: String,
    /// Exact audience exchange endpoint.
    pub exchange_url: String,
}

/// Authorized publication with current visibility, not a cached permission.
#[derive(Clone, Debug)]
pub struct CatalogueContext {
    /// Ready retained publication.
    pub publication: Publication,
    /// Project and current visibility.
    pub project: Project,
}

/// On-demand read of the catalogue cookie value.
pub type ReadCatalogueCookie<'a> = dyn FnMut() -> Option<&'a str> + 'a;

/// Shared access policy for the API and isolated catalogue server.
#[unimock::unimock(api = CatalogueAccessMock)]
pub trait CatalogueAccess: Send + Sync {
    /// Issue a short-lived grant to an already authenticated API user.
    fn grant(
        &self,
        actor: UserId,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<IssuedGrant>;
    /// Consume a grant atomically and return the capability for the bearer and cookie.
    fn exchange(&self, publication: PublicationId, grant: &str) -> Result<String>;
    /// Verify the bearer first and read the cookie when the bearer is absent or invalid.
    /// Check current access in one read transaction. Set `clear_cookie` only
    /// when the cookie fails verification, including on an access denial.
    fn authorize<'request>(
        &self,
        publication: PublicationId,
        bearer: Option<&'request str>,
        cookie: &'request mut ReadCatalogueCookie<'request>,
        clear_cookie: &'request mut bool,
    ) -> Result<CatalogueContext>;
    /// Read API context using its already-authenticated session identity.
    fn read(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<CatalogueContext>;
    /// Resolve a branch alias to a retained ready publication, without file access.
    fn alias(&self, alias: &str) -> Result<Publication>;
}

/// Composition-root access service, consumed through `dyn CatalogueAccess`.
pub struct CatalogueAccessService {
    /// Database executor.
    pub transactions: Arc<dyn Transactions>,
    /// Current membership and visibility policy.
    pub policy: Arc<dyn AccessPolicy>,
    /// Clock and one-use entropy.
    pub runtime: Arc<dyn Runtime>,
    /// Shared signature collaborator.
    pub capabilities: Arc<dyn Capabilities>,
    /// Validated public locations.
    pub locations: Locations,
}

impl CatalogueAccess for CatalogueAccessService {
    fn grant(
        &self,
        actor: UserId,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<IssuedGrant> {
        let now = self.runtime.now();
        let grant = self.runtime.secret().context("generate catalogue grant")?;
        let record = CatalogueGrant {
            digest: hash(&grant),
            publication_id: publication,
            user_id: actor,
            expires_at: now + Duration::seconds(60),
        };
        self.transactions.run(false, &mut |queries| {
            self.policy.read(queries, project, Some(actor))?;
            let value = queries
                .publication(publication)
                .context("read access grant publication")?
                .ok_or(Error::NotFound)?;
            retained(&value)?;
            if value.project_id != project {
                return Err(Error::NotFound);
            }
            queries
                .insert_catalogue_grant(&record)
                .context("persist one-use access grant")?;
            Ok(())
        })?;
        Ok(IssuedGrant {
            grant,
            exchange_url: format!("{}/_access", self.locations.catalogue(publication)),
        })
    }

    fn exchange(&self, publication: PublicationId, grant: &str) -> Result<String> {
        if grant.len() != 64
            || !grant
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(Error::Unauthorized);
        }
        let now = self.runtime.now();
        let mut cookie = None;
        let digest = hash(grant);
        let mut user = None;
        self.transactions.run(false, &mut |queries| {
            user = None;
            let value = queries
                .publication(publication)
                .context("read exchange publication")?
                .ok_or(Error::NotFound)?;
            retained(&value)?;
            let record = queries
                .consume_catalogue_grant(&digest, publication, now)
                .context("consume catalogue grant once")?
                .ok_or(Error::Unauthorized)?;
            self.policy
                .read(queries, value.project_id, Some(record.user_id))?;
            user = Some(record.user_id);
            Ok(())
        })?;
        if let Some(user) = user {
            cookie = Some(self.capabilities.sign(Capability {
                publication,
                user,
                expires: (now + Duration::minutes(5)).timestamp(),
            })?);
        }
        cookie.ok_or(Error::Unauthorized)
    }

    fn authorize<'request>(
        &self,
        publication: PublicationId,
        bearer: Option<&'request str>,
        cookie: &'request mut ReadCatalogueCookie<'request>,
        clear_cookie: &'request mut bool,
    ) -> Result<CatalogueContext> {
        *clear_cookie = false;
        let now = self.runtime.now().timestamp();
        let verify = |credential: &str| match self.capabilities.verify(credential) {
            Ok(capability) if capability.publication == publication && capability.expires > now => {
                Ok(Some(capability.user))
            }
            Ok(_) | Err(Error::Unauthorized) => Ok(None),
            Err(error) => Err(error),
        };
        let bearer_actor = match bearer {
            Some(bearer) => verify(bearer)?,
            None => None,
        };
        let actor = if bearer_actor.is_some() {
            bearer_actor
        } else if let Some(cookie) = cookie() {
            let actor = verify(cookie)?;
            *clear_cookie = actor.is_none();
            actor
        } else {
            None
        };
        let mut result = None;
        self.transactions.run(true, &mut |queries| {
            let value = queries
                .publication(publication)
                .context("read catalogue publication")?
                .ok_or(Error::NotFound)?;
            retained(&value)?;
            let project = self.policy.read(queries, value.project_id, actor)?;
            result = Some(CatalogueContext {
                publication: value,
                project,
            });
            Ok(())
        })?;
        result.ok_or(Error::NotFound)
    }

    fn read(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<CatalogueContext> {
        let mut result = None;
        self.transactions.run(true, &mut |queries| {
            let project = self.policy.read(queries, project, actor)?;
            let value = queries
                .publication(publication)
                .context("read API publication context")?
                .ok_or(Error::NotFound)?;
            if value.project_id != project.id {
                return Err(Error::NotFound);
            }
            result = Some(CatalogueContext {
                publication: value,
                project,
            });
            Ok(())
        })?;
        result.ok_or(Error::NotFound)
    }

    fn alias(&self, alias: &str) -> Result<Publication> {
        let mut result = None;
        self.transactions.run(true, &mut |queries| {
            result = queries
                .branch_alias(alias)
                .context("resolve catalogue branch host")?;
            Ok(())
        })?;
        result.ok_or(Error::NotFound)
    }
}

pub(crate) fn retained(value: &Publication) -> Result<()> {
    if value.state != PublicationState::Ready {
        return Err(Error::NotFound);
    }
    Ok(())
}
