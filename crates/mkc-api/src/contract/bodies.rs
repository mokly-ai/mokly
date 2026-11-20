//! Inline bodies accepted before the operation-specific parser runs.

#![expect(
    dead_code,
    reason = "These bodies describe raw requests parsed by operation-specific handlers."
)]

use utoipa::openapi::schema::{AdditionalProperties, ObjectBuilder};
use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

#[derive(ToSchema)]
#[serde(deny_unknown_fields)]
#[schema(max_properties = 0)]
pub(crate) struct EmptyBody {}

/// Original signed GitHub event JSON, at most 2 MiB. Verified before parsing.
pub(crate) struct GitHubEvent(());

impl PartialSchema for GitHubEvent {
    fn schema() -> RefOr<Schema> {
        open_object("Original signed GitHub event JSON, at most 2 MiB. Verified before parsing.")
    }
}

impl ToSchema for GitHubEvent {}

/// Original Stripe event bytes, retained verbatim.
pub(crate) struct StripeEvent(());

impl PartialSchema for StripeEvent {
    fn schema() -> RefOr<Schema> {
        open_object("Original Stripe event bytes, retained verbatim.")
    }
}

impl ToSchema for StripeEvent {}

/// Open signed payloads must keep explicit metadata for client generators.
fn open_object(description: &str) -> RefOr<Schema> {
    ObjectBuilder::new()
        .description(Some(description))
        .additional_properties(Some(AdditionalProperties::FreeForm(true)))
        .into()
}

#[derive(ToSchema)]
#[schema(value_type = String, format = Binary)]
pub(crate) struct BinaryBody(Vec<u8>);
