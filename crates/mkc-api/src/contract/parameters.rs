//! Header and pagination parameters shared by the operation contracts.

use serde_json::json;
use utoipa::IntoParams;
use utoipa::openapi::schema::{Object, ObjectBuilder, Type};
use uuid::Uuid;

#[derive(IntoParams)]
#[into_params(parameter_in = Header)]
#[expect(
    dead_code,
    reason = "Contract parameters describe headers and queries parsed at runtime."
)]
pub(super) struct Csrf {
    /// Session-bound anti-CSRF token for browser mutations.
    #[param(rename = "X-CSRF-Token")]
    value: String,
}

#[derive(IntoParams)]
#[into_params(parameter_in = Header)]
#[expect(
    dead_code,
    reason = "Contract parameters describe headers and queries parsed at runtime."
)]
pub(super) struct Origin {
    /// Exact configured public application origin, or mokly-app://desktop when MKC_DESKTOP_CLIENT is true;
    /// required on browser mutations including public authentication. Missing or other origins are refused.
    #[param(rename = "Origin", format = "uri")]
    value: String,
}

#[derive(IntoParams)]
#[into_params(parameter_in = Query)]
#[expect(
    dead_code,
    reason = "Contract parameters describe headers and queries parsed at runtime."
)]
pub(super) struct Cursor {
    #[param(rename = "cursor", nullable = false)]
    value: Option<String>,
}

#[derive(IntoParams)]
#[into_params(parameter_in = Query)]
#[expect(
    dead_code,
    reason = "Contract parameters describe headers and queries parsed at runtime."
)]
pub(super) struct Limit {
    #[param(rename = "limit", schema_with = page_limit)]
    value: Option<i64>,
}

#[derive(IntoParams)]
#[into_params(parameter_in = Header)]
#[expect(
    dead_code,
    reason = "Contract parameters describe headers and queries parsed at runtime."
)]
pub(super) struct Idempotency {
    /// Reuse this UUID when retrying the same command.
    #[param(rename = "Idempotency-Key")]
    value: Uuid,
}

#[expect(
    dead_code,
    reason = "Only lint-exempt generated contract code calls this schema helper."
)]
fn page_limit() -> Object {
    ObjectBuilder::new()
        .schema_type(Type::Integer)
        .minimum(Some(1.0))
        .maximum(Some(100.0))
        .default(Some(json!(50)))
        .build()
}
