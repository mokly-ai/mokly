//! Finite persisted GitHub integration and delivery states.

use std::result;
use std::str::FromStr;

use thiserror::Error;

/// Corrupt persisted enum values, converted to store Internal at the read site.
#[derive(Debug, Error)]
pub enum ParseError {
    /// Invalid installation account category.
    #[error("[mkc-store-interface/github_state] invalid account kind")]
    AccountKind,
    /// Invalid OAuth operation purpose.
    #[error("[mkc-store-interface/github_state] invalid flow purpose")]
    FlowPurpose,
    /// Invalid durable delivery state.
    #[error("[mkc-store-interface/github_state] invalid delivery status")]
    DeliveryStatus,
    /// Invalid delivery failure category.
    #[error("[mkc-store-interface/github_state] invalid failure category")]
    Failure,
}

macro_rules! state {
    ($name:ident, $doc:literal, $(($variant:ident, $value:literal, $variant_doc:literal)),+ $(,)?) => {
        #[doc = $doc]
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        pub enum $name {
            $(#[doc = $variant_doc] $variant),+
        }

        impl $name {
            /// Stable SQL representation.
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }

        impl FromStr for $name {
            type Err = ParseError;

            fn from_str(value: &str) -> result::Result<Self, Self::Err> {
                match value {
                    $($value => Ok(Self::$variant)),+,
                    _ => Err(ParseError::$name),
                }
            }
        }
    };
}

state!(
    AccountKind,
    "Installation owner category.",
    (User, "user", "Personal GitHub account."),
    (Organization, "organization", "GitHub organization."),
);
state!(
    FlowPurpose,
    "Authenticated purpose of a one-use OAuth flow.",
    (SignIn, "sign-in", "Public GitHub sign-in."),
    (Connect, "connect", "Link to the initiating cloud account."),
    (
        Install,
        "install",
        "Bind an installation to a cloud organization."
    ),
);
state!(
    DeliveryStatus,
    "Durable webhook queue state.",
    (Pending, "pending", "Accepted and waiting until due."),
    (
        Processing,
        "processing",
        "Claimed under a recoverable lease."
    ),
    (Done, "done", "Handler effects committed."),
    (
        Ignored,
        "ignored",
        "Unsupported event/action or unrelated resource."
    ),
    (
        Failed,
        "failed",
        "Malformed or exhausted; retained for inspection."
    ),
);
state!(
    Failure,
    "Safe failure class without provider payloads or secrets.",
    (Malformed, "malformed", "Known event failed typed decoding."),
    (
        Forbidden,
        "forbidden",
        "Provider permission is insufficient."
    ),
    (Unavailable, "unavailable", "Transient provider outage."),
    (
        RateLimited,
        "rate-limited",
        "Provider retry deadline must be honored."
    ),
    (
        Internal,
        "internal",
        "Unhandled database or runtime failure."
    ),
);
