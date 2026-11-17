//! One-use catalogue credential responses; values never implement Debug.

use std::fmt;

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = AccessGrant)]
pub(crate) struct AccessGrantView {
    /// One-use secret expiring after sixty seconds; send only in the exchange JSON body.
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) grant: String,
    /// Exact publication-host access endpoint.
    #[schema(format = "uri")]
    pub(crate) exchange_url: String,
}

impl fmt::Debug for AccessGrantView {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AccessGrantView")
            .finish_non_exhaustive()
    }
}
