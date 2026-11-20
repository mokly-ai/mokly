//! Members operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::input::{Invite, RoleUpdate, Version};
use crate::payload::Page;
use crate::views::workspaces::MemberView;

use super::parameters::{Csrf, Cursor, Limit, Origin};
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    list_members,
    invite_member,
    update_member,
    remove_member,
    accept_invitation
))]
pub(super) struct Doc;

#[utoipa::path(
    get,
    path = "/v1/workspaces/{workspaceId}/members",
    operation_id = "listMembers",
    tag = "Workspace",
    summary = "List members and pending invitations.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Cursor,
        Limit,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = Page<MemberView>, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn list_members() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces/{workspaceId}/members",
    operation_id = "inviteMember",
    tag = "Workspace",
    summary = "Invite a member by email.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Invite, content_type = "application/json"),
    responses(
        (status = 201, description = "Successful operation.", body = MemberView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::ALREADY_MEMBER,
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn invite_member() {}

#[utoipa::path(
    patch,
    path = "/v1/workspaces/{workspaceId}/members/{memberId}",
    operation_id = "updateMember",
    tag = "Workspace",
    summary = "Change a role while preserving the last owner.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        ("memberId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = RoleUpdate, content_type = "application/json"),
    responses(
        (status = 200, description = "Successful operation.", body = MemberView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::LAST_OWNER,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn update_member() {}

#[utoipa::path(
    delete,
    path = "/v1/workspaces/{workspaceId}/members/{memberId}",
    operation_id = "removeMember",
    tag = "Workspace",
    summary = "Remove a member or revoke an invitation.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        ("memberId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    request_body(content = Version, content_type = "application/json"),
    responses(
        (status = 204, description = "Successful operation."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::LAST_OWNER,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::PERMISSION_DENIED,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
        reasons::VERSION_CONFLICT,
    ])))
)]
fn remove_member() {}

#[utoipa::path(
    post,
    path = "/v1/workspaces/{workspaceId}/invitations/{memberId}/accept",
    operation_id = "acceptInvitation",
    tag = "Workspace",
    summary = "Accept an invitation for your verified email.",
    params(
        ("workspaceId" = String, Path, format = "uuid"),
        ("memberId" = String, Path, format = "uuid"),
        Csrf,
        Origin,
    ),
    responses(
        (status = 200, description = "Successful operation.", body = MemberView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
        reasons::CSRF_REJECTED,
        reasons::INTERNAL_ERROR,
        reasons::INVITATION_EXPIRED,
        reasons::NOT_FOUND,
        reasons::PAYLOAD_TOO_LARGE,
        reasons::SESSION_EXPIRED,
        reasons::UNAUTHENTICATED,
        reasons::VALIDATION_FAILED,
    ])))
)]
fn accept_invitation() {}
