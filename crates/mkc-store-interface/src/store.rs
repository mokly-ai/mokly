//! Serializable transaction boundary; callbacks may be retried.

use crate::billing_checkout::BillingCheckoutSessions;
use crate::billing_customer::BillingCustomers;
use crate::billing_delivery::BillingDeliveries;
use crate::billing_seat_command::BillingSeatCommands;
use crate::billing_subscription::BillingSubscriptions;
use crate::blob::Blobs;
use crate::build::Builds;
use crate::build_check::BuildChecks;
use crate::build_grant::BuildUploadGrants;
use crate::build_history::BuildReads;
use crate::build_log::BuildLogs;
use crate::desktop_grant::DesktopGrants;
use crate::error::Result;
use crate::github_check::GitHubChecks;
use crate::github_delivery::GitHubDeliveries;
use crate::github_identity::GitHubIdentities;
use crate::github_installation::GitHubInstallations;
use crate::github_refs::GitHubRefs;
use crate::github_repository::GitHubRepositories;
use crate::github_retention::GitHubRetention;
use crate::grant::Grants;
use crate::integration::Integrations;
use crate::magic_link::MagicLinks;
use crate::member::Members;
use crate::organization::Organizations;
use crate::project::Projects;
use crate::publication::Publications;
use crate::publication_event::PublicationEvents;
use crate::publication_screens::PublicationScreens;
use crate::rate_limit::RateLimits;
use crate::session::Sessions;
use crate::token::Tokens;
use crate::user::Users;
use crate::viewer::ViewerReads;

/// All queries available inside one transaction.
pub trait Queries:
    Users
    + Organizations
    + BillingCustomers
    + BillingCheckoutSessions
    + BillingSubscriptions
    + BillingDeliveries
    + BillingSeatCommands
    + Members
    + Projects
    + Grants
    + Tokens
    + MagicLinks
    + DesktopGrants
    + Sessions
    + RateLimits
    + Integrations
    + GitHubChecks
    + GitHubDeliveries
    + GitHubIdentities
    + GitHubInstallations
    + GitHubRefs
    + GitHubRepositories
    + GitHubRetention
    + Publications
    + Blobs
    + Builds
    + BuildReads
    + BuildChecks
    + BuildUploadGrants
    + BuildLogs
    + PublicationEvents
    + ViewerReads
    + PublicationScreens
{
}

impl Queries for unimock::Unimock {}

/// Explicit outcome of query-only work; policy errors remain with the caller.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    /// Commit the transaction.
    Commit,
    /// Roll back without retrying a caller-owned policy rejection.
    Rollback,
}

/// Query-only work that may be repeated after a serialization conflict.
pub trait Transaction {
    /// Execute against the connection owned by the store.
    fn run(&mut self, queries: &mut dyn Queries) -> Result<Decision>;
}

/// Borrowed closure adapter; runtime dependencies remain trait objects.
pub struct Callback<'a>(pub &'a mut dyn FnMut(&mut dyn Queries) -> Result<()>);

impl Transaction for Callback<'_> {
    fn run(&mut self, queries: &mut dyn Queries) -> Result<Decision> {
        self.0(queries)?;
        Ok(Decision::Commit)
    }
}

/// A transactional store. Callbacks must perform database work only.
#[unimock::unimock(api = StoreMock)]
pub trait Store: Send + Sync {
    /// Run atomically, retrying serialization conflicts up to eight attempts.
    fn transaction(&self, work: &mut dyn Transaction) -> Result<()>;
    /// Run read-only work at READ COMMITTED without locking session rows.
    fn read(&self, work: &mut dyn Transaction) -> Result<()>;
    /// Run once without BEGIN or retry; each statement commits independently.
    /// Callbacks must use one atomic statement and return `Decision::Commit`.
    fn autocommit(&self, work: &mut dyn Transaction) -> Result<()>;
}
