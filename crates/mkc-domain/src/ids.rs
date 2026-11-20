//! Opaque entity identifiers, deliberately separate from ID generation.

use std::fmt;

use serde::{Deserialize, Serialize};
#[cfg(feature = "openapi")]
use utoipa::ToSchema;
use uuid::Uuid;

macro_rules! identifier {
    ($name:ident, $doc:literal) => {
        #[doc = $doc]
        #[derive(
            Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
        )]
        #[cfg_attr(feature = "openapi", derive(ToSchema))]
        #[serde(transparent)]
        pub struct $name(pub Uuid);

        impl From<Uuid> for $name {
            fn from(value: Uuid) -> Self {
                Self(value)
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(formatter)
            }
        }
    };
}

identifier!(UserId, "An account identifier.");
identifier!(OrganizationId, "A workspace identifier.");
identifier!(MemberId, "A membership or pending invitation identifier.");
identifier!(ProjectId, "A project identifier.");
identifier!(GrantId, "A direct project grant identifier.");
identifier!(TokenId, "A publishing token identifier.");
identifier!(InstallationId, "A cloud GitHub installation identifier.");
identifier!(RepositoryId, "An installed GitHub repository identifier.");
identifier!(BuildId, "A cloud build identifier.");
identifier!(
    PublicationId,
    "An immutable publication or upload attempt identifier."
);
