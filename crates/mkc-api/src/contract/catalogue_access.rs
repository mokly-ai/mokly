//! Catalogue Access operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::publication_views::AccessGrantView;

use super::bodies::EmptyBody;
use super::parameters::Csrf;
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(issue_catalogue_grant))]
pub(super) struct Doc;

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/publications/{publicationId}/access-grants",
    operation_id = "issueCatalogueGrant",
    tag = "Workspace",
    summary = "Issue one-use access to a retained publication.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
        Csrf,
    ),
    request_body(content = inline(EmptyBody), content_type = "application/json"),
    responses(
        (status = 201, description = "One-use grant; response is never cached.", body = AccessGrantView, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    extensions(("x-reasons" = json!([
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
fn issue_catalogue_grant() {}
