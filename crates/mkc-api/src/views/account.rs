//! Account response schemas.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{OrganizationId, UserId};
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = User)]
pub(crate) struct UserView {
    #[schema(inline, format = Uuid)]
    pub(crate) id: UserId,
    pub(crate) name: String,
    #[schema(format = "email")]
    pub(crate) email: String,
    pub(crate) github_connected: bool,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Session)]
pub(crate) struct SessionView {
    pub(crate) user: UserView,
    pub(crate) csrf_token: String,
    #[schema(inline)]
    pub(crate) workspace_ids: Vec<OrganizationId>,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = SessionIssued)]
pub(crate) struct SessionIssuedView {
    pub(crate) session: SessionView,
    pub(crate) return_to: String,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = MagicLinkResult)]
pub(crate) struct MagicLinkView {
    #[schema(format = Uuid)]
    pub(crate) request_id: Uuid,
    #[schema(format = DateTime)]
    pub(crate) resend_after: DateTime<Utc>,
}
