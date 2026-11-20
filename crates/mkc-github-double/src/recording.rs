//! Sanitized GitHub responses captured once and replayed verbatim.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{ErrorResultExt, Result};

/// One recorded HTTP answer: status, headers and JSON body.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Recording {
    /// HTTP status code.
    pub status: u16,
    /// Response headers, replayed verbatim.
    pub headers: BTreeMap<String, String>,
    /// Response body.
    pub body: Value,
}

/// The complete set of provider answers the double can replay.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Recorded {
    /// A single installation, including its GitHub settings URL.
    Installation,
    /// A second installation owned by a GitHub organization.
    OrganizationInstallation,
    /// The second installation's selected repository.
    OrganizationRepositories,
    /// The authorizing user's active administrator membership.
    OrganizationMembership,
    /// The installation's selected repositories.
    Repositories,
    /// A minted installation access token.
    InstallationToken,
    /// A minted installation token scoped to one repository's contents.
    RepositoryToken,
    /// A user access token from the authorization code exchange.
    OAuthToken,
    /// The authorizing user's profile.
    User,
    /// The authorizing user's verified email addresses.
    Emails,
    /// The installations the authorizing user administers.
    UserInstallations,
    /// One pull request.
    PullRequest,
    /// The App's check runs on one commit.
    CheckList,
    /// A newly created check run.
    CheckCreate,
    /// An updated check run.
    CheckUpdate,
    /// One branch and its head commit.
    Branch,
    /// GitHub's absent-resource answer.
    NotFound,
    /// GitHub's temporary-failure answer.
    Unavailable,
}

impl Recorded {
    /// The captured JSON document backing this answer.
    const fn source(self) -> &'static str {
        match self {
            Self::OrganizationInstallation => {
                include_str!("../../mkc-github/fixtures/installation-organization.json")
            }
            Self::OrganizationRepositories => {
                include_str!("../../mkc-github/fixtures/repositories-organization.json")
            }
            Self::OrganizationMembership => {
                include_str!("../../mkc-github/fixtures/organization-membership.json")
            }
            Self::Installation => include_str!("../../mkc-github/fixtures/installation.json"),
            Self::Repositories => include_str!("../../mkc-github/fixtures/repositories.json"),
            Self::InstallationToken => {
                include_str!("../../mkc-github/fixtures/installation-token.json")
            }
            Self::RepositoryToken => {
                include_str!("../../mkc-github/fixtures/repository-token.json")
            }
            Self::OAuthToken => include_str!("../../mkc-github/fixtures/oauth-token.json"),
            Self::User => include_str!("../../mkc-github/fixtures/user.json"),
            Self::Emails => include_str!("../../mkc-github/fixtures/emails.json"),
            Self::UserInstallations => {
                include_str!("../../mkc-github/fixtures/user-installations.json")
            }
            Self::PullRequest => include_str!("../../mkc-github/fixtures/pull-request.json"),
            Self::CheckList => include_str!("../../mkc-github/fixtures/check-list.json"),
            Self::CheckCreate => include_str!("../../mkc-github/fixtures/check-create.json"),
            Self::CheckUpdate => include_str!("../../mkc-github/fixtures/check-update.json"),
            Self::Branch => include_str!("../../mkc-github/fixtures/branch.json"),
            Self::NotFound => include_str!("../../mkc-github/fixtures/not-found.json"),
            Self::Unavailable => include_str!("../../mkc-github/fixtures/unavailable.json"),
        }
    }

    /// Decode this answer into an independently mutable recording.
    pub fn response(self) -> Result<Recording> {
        serde_json::from_str(self.source()).context("decode GitHub recording")
    }
}
