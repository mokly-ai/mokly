//! Browser-authorized desktop grant issue and exchange operations.

use crate::contract::error::Error;
use crate::contract::parameter_schemas::PositiveInteger;
use crate::contract::parameters::{Csrf, Origin};
use crate::contract::reasons;
use crate::contract::responses::ErrorResponse;
use crate::desktop_grant_input::{DesktopGrantCallback, DesktopGrantRequest};
use crate::views::account::{DesktopGrantView, SessionIssuedView};

#[utoipa::path(
    post,
    path = "/v1/auth/desktop/grants",
    operation_id = "issueDesktopGrant",
    tag = "Account",
    summary = "Authorize a desktop window from the current browser session.",
    params(Csrf, Origin),
    request_body(content = DesktopGrantRequest, content_type = "application/json"),
    responses(
        (status = 201, description = "One-use grant, expiring at the earlier of five minutes and the issuing session's absolute deadline.", body = DesktopGrantView, content_type = "application/json",
            headers(("Cache-Control" = String, description = "no-store"))),
        (status = 429, description = "Persistent peer admission limit reached.", body = Error, content_type = "application/json",
            headers(("Retry-After" = inline(PositiveInteger), description = "Seconds until another attempt can be admitted."))),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::DESKTOP_GRANT_INVALID,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
pub(super) fn issue() {}

#[utoipa::path(
    post,
    path = "/v1/auth/desktop/callback",
    operation_id = "exchangeDesktopGrant",
    tag = "Account",
    summary = "Consume a desktop grant and issue a session with the inherited deadline.",
    params(Origin),
    request_body(content = DesktopGrantCallback, content_type = "application/json"),
    responses(
        (status = 200, description = "Session and stored destination. Max-Age is the time remaining until the issuing session's absolute deadline.", body = SessionIssuedView, content_type = "application/json",
            headers(
                ("Set-Cookie" = String),
                ("Cache-Control" = String, description = "no-store"),
            )),
        (status = 429, description = "Persistent peer admission limit reached.", body = Error, content_type = "application/json",
            headers(("Retry-After" = inline(PositiveInteger), description = "Seconds until another attempt can be admitted."))),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::DESKTOP_GRANT_INVALID,
        reasons::INTERNAL_ERROR,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::RATE_LIMITED,
        reasons::VALIDATION_FAILED,
    ])))
)]
pub(super) fn exchange() {}
