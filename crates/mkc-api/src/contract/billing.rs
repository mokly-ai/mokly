//! Billing operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::billing::views::{Billing, HostedSession};

use super::aliases::PortalSession;
use super::bodies::{EmptyBody, StripeEvent};
use super::parameters::{Csrf, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    get_billing,
    start_checkout,
    open_billing_portal,
    receive_billing_webhook
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/workspaces/{workspaceId}/billing",
    operation_id = "getBilling",
    tag = "Workspace",
    summary = "Read the workspace's plan, seats and subscription.",
    description = "Owners and admins read persisted billing state and verified catalogue prices. Unconfigured billing returns `operation-unavailable`.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Billing, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn get_billing() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces/{workspaceId}/billing/checkout",
    operation_id = "startCheckout",
    tag = "Workspace",
    summary = "Start Stripe Checkout for the Team plan.",
    description = "Owners only. Creates the customer when absent and a Checkout session with the trial when eligible; refused with `subscription-active` while a subscription is live and `operation-unavailable` while billing is unconfigured or its prices are unverified. A Stripe rate limit returns `rate-limited` and a Stripe outage `unavailable`.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = inline(EmptyBody), content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = HostedSession, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::SUBSCRIPTION_ACTIVE,
        reasons::UNAUTHENTICATED,
        reasons::UNAVAILABLE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn start_checkout() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces/{workspaceId}/billing/portal",
    operation_id = "openBillingPortal",
    tag = "Workspace",
    summary = "Open the Stripe Customer Portal.",
    description = "Owners only; the Portal carries payment methods, invoices and cancellation. A Stripe rate limit returns `rate-limited` and a Stripe outage `unavailable`.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = inline(EmptyBody), content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = PortalSession, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::RATE_LIMITED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::UNAVAILABLE,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn open_billing_portal() {}

#[utoipa::path(
    post,
    path = "/v1/billing/webhooks",
    operation_id = "receiveBillingWebhook",
    tag = "Workspace",
    summary = "Accept a signed Stripe event.",
    description = "Session-independent. The `Stripe-Signature` header is verified over the raw body before decoding; a failed verification returns `webhook-signature-invalid`. Unconfigured billing returns `operation-unavailable`.",
    params(
        ("Stripe-Signature" = String, Header),
    ),
    request_body(content = inline(StripeEvent), content_type = "application/json"),
    responses(
        (status = 202, description = "Successful operation."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::OPERATION_UNAVAILABLE,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::VALIDATION_FAILED,
        reasons::WEBHOOK_SIGNATURE_INVALID,
    ])))
)]
fn receive_billing_webhook() {}
