//! Tokens response schemas.

use chrono::{DateTime, Utc};
use mkc_domain::ids::TokenId;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Token)]
pub(crate) struct TokenView {
    #[schema(inline, format = Uuid)]
    pub(crate) id: TokenId,
    pub(crate) name: String,
    pub(crate) prefix: String,
    #[schema(format = DateTime)]
    pub(crate) created_at: DateTime<Utc>,
    #[schema(required, format = DateTime)]
    pub(crate) last_used_at: Option<DateTime<Utc>>,
    pub(crate) revoked: bool,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct TokenCreated {
    pub(crate) token: TokenView,
    /// Returned exactly once; never persisted by the browser.
    #[schema(write_only = false)]
    pub(crate) secret: String,
}
