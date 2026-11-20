//! Optional provider integration read boundary.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{OrganizationId, UserId};

use crate::error::Result;

/// Entity whose provider connection is being read.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntegrationSubject {
    /// Account identity connection.
    User(UserId),
    /// Organization provider ownership.
    Organization(OrganizationId),
}

/// Stored provider identity when an integration exists.
#[derive(Clone, Debug)]
pub struct Integration {
    /// Provider account name displayed to the caller.
    pub account: String,
}

/// Provider-identity reads; absence is represented without fabricated metadata.
#[unimock::unimock(api = IntegrationsMock)]
pub trait Integrations {
    /// Read the optional integration for this entity.
    fn integration(&mut self, subject: IntegrationSubject) -> Result<Option<Integration>>;
    /// Persist a verified GitHub identity without writing generated FK columns.
    fn save_integration(
        &mut self,
        subject: IntegrationSubject,
        account: &str,
        now: DateTime<Utc>,
    ) -> Result<()>;
    /// Remove the GitHub integration for the specified subject.
    fn delete_integration(&mut self, subject: IntegrationSubject) -> Result<()>;
}
