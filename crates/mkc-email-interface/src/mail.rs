//! Mail delivery contract shared by authentication and invitation services.

use std::result;

use internal_error::InternalError;
use thiserror::Error;

/// Delivery failures preserve provider diagnostics internally.
#[derive(Debug, Error, internal_error::ErrorContract)]
pub enum Error {
    /// An unhandled transport or provider failure.
    #[error("[mkc-email-interface/mail] internal: {0:?}")]
    Internal(#[from] InternalError),
}

/// Mail delivery result.
pub type Result<T> = result::Result<T, Error>;

/// Lifetime displayed in a transactional message.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lifetime {
    /// A one-time sign-in link's validity in minutes.
    Minutes(u32),
    /// An invitation's validity in days.
    Days(u32),
}

impl Lifetime {
    /// Format the same expiry interval used by the issuing service.
    pub fn phrase(self) -> String {
        let (count, unit) = match self {
            Self::Minutes(count) => (count, "minute"),
            Self::Days(count) => (count, "day"),
        };
        format!("{count} {unit}{}", if count == 1 { "" } else { "s" })
    }
}

/// Typed values Postmark substitutes into one hosted template. Deliberately
/// not `Debug`: a sign-in link is a credential and must never reach a log.
#[derive(Clone)]
pub enum Content {
    /// Sign in or create an account by proving email ownership.
    SignIn {
        /// Complete one-time callback URL.
        link: String,
        /// Expiry interval from the issuing service.
        valid_for: Lifetime,
    },
    /// Accept an invitation from a named person to a named organization.
    Invitation {
        /// Complete invitation acceptance URL.
        link: String,
        /// Stored organization name.
        organization: String,
        /// Stored inviter display name.
        invited_by: String,
        /// Expiry interval from the invitation policy.
        valid_for: Lifetime,
    },
}

impl Content {
    /// The action URL emitted only by the development log mailer.
    pub fn link(&self) -> &str {
        match self {
            Self::SignIn { link, .. } | Self::Invitation { link, .. } => link,
        }
    }
}

/// A single-recipient message; never log in production.
#[derive(Clone)]
pub struct Message {
    /// Validated destination address.
    pub recipient: String,
    /// Product action and values, containing a credential only for sign-in.
    pub content: Content,
}

/// Synchronous delivery; call from a blocking worker, never an async reactor.
#[unimock::unimock(api = MailerMock)]
pub trait Mailer: Send + Sync {
    /// Submit exactly one message, without automatic retries of ambiguous sends.
    fn send(&self, message: &Message) -> Result<()>;
}

#[cfg(test)]
#[path = "_tests_/mail_tests.rs"]
mod mail_tests;
