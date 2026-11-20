//! Finite permission and visibility values shared by the API and stores.

use std::str::FromStr;

use serde::{Deserialize, Serialize};
use thiserror::Error;
#[cfg(feature = "openapi")]
use utoipa::ToSchema;

/// An invalid finite domain value.
#[derive(Debug, Error)]
pub enum Error {
    /// The role is outside the platform's role vocabulary.
    #[error("[mkc-domain/values] invalid role")]
    Role,
    /// The visibility is outside the platform's visibility vocabulary.
    #[error("[mkc-domain/values] invalid visibility")]
    Visibility,
    /// The plan is outside the billing plan catalogue.
    #[error("[mkc-domain/values] invalid plan")]
    Plan,
    /// The seat kind is outside the billing seat catalogue.
    #[error("[mkc-domain/values] invalid seat kind")]
    SeatKind,
}

/// Ordered privilege levels; direct access can only increase inherited access.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum Role {
    /// Workspace ownership and owner management.
    Owner = 3,
    /// Project and non-owner membership administration.
    Admin = 2,
    /// Read access and workspace project creation.
    Member = 1,
    /// Read access.
    Reviewer = 0,
}

impl Role {
    /// Stable SQL and JSON spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reviewer => "reviewer",
            Self::Member => "member",
            Self::Admin => "admin",
            Self::Owner => "owner",
        }
    }

    /// Whether this role can administer a project.
    pub fn can_admin(self) -> bool {
        self >= Self::Admin
    }

    /// The project role inherited from this workspace role.
    pub fn project_role(self) -> Self {
        self.min(Self::Admin)
    }
}

impl FromStr for Role {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        match value {
            "owner" => Ok(Self::Owner),
            "admin" => Ok(Self::Admin),
            "member" => Ok(Self::Member),
            "reviewer" => Ok(Self::Reviewer),
            _ => Err(Error::Role),
        }
    }
}

/// Whether anonymous reads are permitted.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum Visibility {
    /// Only members and direct grantees can read.
    Private,
    /// Anyone can read; administration still requires membership.
    Public,
}

impl Visibility {
    /// Stable SQL and JSON spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Private => "private",
            Self::Public => "public",
        }
    }
}

impl FromStr for Visibility {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        match value {
            "private" => Ok(Self::Private),
            "public" => Ok(Self::Public),
            _ => Err(Error::Visibility),
        }
    }
}

/// The billing plan a workspace is on; written only by the billing worker.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum Plan {
    /// Open-source catalogues: every project is public and nothing is billed.
    Free,
    /// Private projects, billed monthly per Editor and Collaborator seat.
    Team,
}

impl Plan {
    /// Stable SQL and JSON spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Team => "team",
        }
    }
}

impl FromStr for Plan {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        match value {
            "free" => Ok(Self::Free),
            "team" => Ok(Self::Team),
            _ => Err(Error::Plan),
        }
    }
}

/// Billing category derived from a user's strongest workspace role.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum SeatKind {
    /// Owner, administrator or member access with editing capability.
    Editor,
    /// Reviewer access without editing capability.
    Collaborator,
}

impl SeatKind {
    /// Stable SQL and JSON spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Editor => "editor",
            Self::Collaborator => "collaborator",
        }
    }
}

impl FromStr for SeatKind {
    type Err = Error;

    fn from_str(value: &str) -> Result<Self, Error> {
        match value {
            "editor" => Ok(Self::Editor),
            "collaborator" => Ok(Self::Collaborator),
            _ => Err(Error::SeatKind),
        }
    }
}

#[cfg(test)]
#[path = "_tests_/values_tests.rs"]
mod values_tests;
