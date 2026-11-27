//! Public configuration operation contract.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::configuration::ConfigurationView;

use super::parameter_schemas::NoStore;
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(get_configuration))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/configuration",
    operation_id = "getConfiguration",
    tag = "Configuration",
    summary = "Read which optional operations have runtime configuration",
    responses(
        (status = 200, description = "The optional configuration of this API.", body = ConfigurationView, content_type = "application/json",
            headers(
                ("Cache-Control" = inline(NoStore)),
            )
        ),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_configuration() {}
