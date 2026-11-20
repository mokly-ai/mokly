//! Scalar schemas for headers and query parameters without integer format hints.

use utoipa::openapi::schema::{ObjectBuilder, Type};
use utoipa::openapi::{RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

pub(super) struct PositiveInteger;

impl ToSchema for PositiveInteger {}

impl PartialSchema for PositiveInteger {
    fn schema() -> RefOr<Schema> {
        ObjectBuilder::new()
            .schema_type(Type::Integer)
            .minimum(Some(1.0))
            .build()
            .into()
    }
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum NoStore {
    NoStore,
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum ShareViewport {
    Desktop,
    Mobile,
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum ColorScheme {
    Light,
    Dark,
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum ThreadState {
    Open,
    Resolved,
    All,
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum ThreadCurrency {
    Current,
    Outdated,
    Unverified,
    All,
}

#[derive(ToSchema)]
#[serde(rename_all = "kebab-case")]
#[expect(
    dead_code,
    reason = "Variants describe the accepted header or query values."
)]
pub(super) enum ThreadViewport {
    Mobile,
    Desktop,
}

/// A valid repository-relative TypeScript config path.
#[derive(ToSchema)]
#[expect(
    dead_code,
    reason = "The wrapped string supplies an inline query schema."
)]
pub(super) struct ConfigPath(String);
