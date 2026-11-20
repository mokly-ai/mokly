//! Operation-specific schema names for shared runtime shapes.

#![expect(
    dead_code,
    reason = "These names describe shared inputs and outputs without adding runtime wrappers."
)]

use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

use crate::billing::views::HostedSession;
use crate::input::{Name, RoleUpdate};

use super::scalars::project_role;

#[derive(ToSchema)]
pub(crate) struct CreateToken(#[schema(inline)] Name);

pub(crate) struct UpdateGrant;

impl ToSchema for UpdateGrant {}

impl PartialSchema for UpdateGrant {
    fn schema() -> RefOr<Schema> {
        let mut schema = RoleUpdate::schema();
        if let RefOr::T(Schema::Object(object)) = &mut schema {
            object
                .properties
                .insert("role".into(), project_role().into());
        }
        schema
    }
}

/// Stripe-hosted Customer Portal; the browser navigates there.
pub(crate) struct PortalSession;

impl ToSchema for PortalSession {}

impl PartialSchema for PortalSession {
    fn schema() -> RefOr<Schema> {
        let mut schema = HostedSession::schema();
        if let RefOr::T(Schema::Object(object)) = &mut schema
            && let Some(RefOr::T(Schema::Object(url))) = object.properties.get_mut("url")
        {
            url.description =
                Some("Stripe-hosted Customer Portal; the browser navigates there.".into());
        }
        schema
    }
}
