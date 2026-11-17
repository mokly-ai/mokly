//! Reusable HTTP response components for the operation contracts.

use utoipa::ToResponse;

use super::error::Error;

/// Standard failure response whose body uses the shared error envelope.
#[derive(ToResponse)]
#[response(
    description = "rpc-error envelope; the standard code fixes the status, except for the upload statuses that the Error schema names, and the reason names the condition. See the API conventions and rest-api.md."
)]
pub(super) struct ErrorResponse(Error);
