//! Health operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::health::HealthView;

use super::error::Error;
use super::parameter_schemas::NoStore;
use super::reasons;

#[derive(OpenApi)]
#[openapi(paths(get_health))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/health",
    operation_id = "getHealth",
    tag = "Health",
    summary = "Read process version and cached database migration readiness",
    responses(
        (status = 200, description = "API is serving with no pending database migrations.", body = inline(HealthView), content_type = "application/json",
            headers(
                ("Cache-Control" = inline(NoStore)),
            )
        ),
        (status = 500, description = "The live database readiness query failed.", body = Error, content_type = "application/json"),
        (status = 503, description = "The running binary has pending database migrations (503 unavailable / migrations-pending).", body = Error, content_type = "application/json"),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::MIGRATIONS_PENDING,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_health() {}
