//! Approvals operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::payload::Page;

use super::deferred::approval_input::Approve;
use super::deferred::approvals::{Approval, Review};
use super::deferred::audit::AuditEvent;
use super::parameters::{Csrf, Cursor, Idempotency, Limit};
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(get_review, approve_publication, withdraw_approval, list_review_audit))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/reviews/{reviewId}",
    operation_id = "getReview",
    tag = "Review",
    summary = "Read approval state and reviewer eligibility.",
    params(
        ("reviewId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Review, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn get_review() {}

#[utoipa::path(
    post,
    path = "/v1/reviews/{reviewId}/approvals",
    operation_id = "approvePublication",
    tag = "Review",
    summary = "Approve the exact ready publication and head.",
    params(
        ("reviewId" = String, Path, format = "uuid"),
        Csrf,
        Idempotency,
    ),
    request_body(content = Approve, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = Approval, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn approve_publication() {}

#[utoipa::path(
    delete,
    path = "/v1/reviews/{reviewId}/approvals/{approvalId}",
    operation_id = "withdrawApproval",
    tag = "Review",
    summary = "Withdraw your own approval; retain its audit history.",
    params(
        ("reviewId" = String, Path, format = "uuid"),
        ("approvalId" = String, Path, format = "uuid"),
        Csrf,
    ),
    responses(
        (status = 204, description = "Successful operation."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn withdraw_approval() {}

#[utoipa::path(
    get,
    path = "/v1/reviews/{reviewId}/audit",
    operation_id = "listReviewAudit",
    tag = "Review",
    summary = "Read authorized review audit events.",
    params(
        ("reviewId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<AuditEvent>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
)]
fn list_review_audit() {}
