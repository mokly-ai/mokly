//! Uploads operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use utoipa::OpenApi;

use crate::upload::Receipt;
use crate::upload_plan::PlanResponse;

use super::bodies::BinaryBody;
use super::reasons;
use super::responses::ErrorResponse;

#[derive(OpenApi)]
#[openapi(paths(
    upload_publication,
    upload_publication_blob,
    complete_publication_upload
))]
pub(super) struct Doc;

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/publications",
    operation_id = "uploadPublication",
    tag = "Workspace",
    summary = "Plan a publication upload.",
    description = "Streams one gzip plan archive holding the upload envelope, the export ownership marker and the catalogue index. Validates the declared catalogue, stores those artifacts, reserves every declared file and answers the file hashes this project still needs. A head already published for the same config answers an empty plan. See publication-upload-exchange.md for quotas and status compatibility.",
    params(
        ("projectId" = String, Path, format = "uuid"),
    ),
    request_body(content = inline(BinaryBody), content_type = "application/gzip"),
    responses(
        (status = 200, description = "Upload plan for this attempt.", body = PlanResponse, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(("projectToken" = [])),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::VALIDATION_FAILED,
        reasons::UPLOAD_UNSUPPORTED_VERSION,
        reasons::UPLOAD_INVALID_BUNDLE,
        reasons::UPLOAD_UNAUTHORIZED,
        reasons::UPLOAD_FORBIDDEN,
        reasons::UPLOAD_PLAN_REQUIRED,
        reasons::UPLOAD_TOO_LARGE,
        reasons::UPLOAD_UNAVAILABLE,
        reasons::UPLOAD_TIMEOUT,
        reasons::UPLOAD_FAILED,
    ])))
)]
fn upload_publication() {}

#[utoipa::path(
    put,
    path = "/v1/projects/{projectId}/publication-uploads/{publicationId}/blobs/{sha256}",
    operation_id = "uploadPublicationBlob",
    tag = "Workspace",
    summary = "Store one file the upload plan reported missing.",
    description = "Sends one reserved file as raw application/octet-stream bytes or as a gzip body with Content-Encoding: gzip. Raw Content-Length must equal the reserved decoded size. A gzip Content-Length must not exceed that size. The server bounds decoding at the declared size plus one byte, verifies decoded size and SHA-256 before storage, and answers 400 without storing bytes for invalid gzip or a decoded mismatch. A file the project already stored answers 204 after draining the body. See publication-upload-exchange.md.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
        ("sha256" = String, Path, pattern = "^[a-f0-9]{64}$"),
    ),
    request_body(content = inline(BinaryBody), content_type = "application/octet-stream"),
    responses(
        (status = 204, description = "The project holds these bytes."),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(("projectToken" = [])),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::VALIDATION_FAILED,
        reasons::UPLOAD_INVALID_BUNDLE,
        reasons::UPLOAD_UNAUTHORIZED,
        reasons::UPLOAD_FORBIDDEN,
        reasons::UPLOAD_PLAN_REQUIRED,
        reasons::UPLOAD_TOO_LARGE,
        reasons::UPLOAD_UNAVAILABLE,
        reasons::UPLOAD_TIMEOUT,
        reasons::UPLOAD_BLOB_MISMATCH,
        reasons::UPLOAD_UNKNOWN_BLOB,
        reasons::UPLOAD_EXPIRED,
        reasons::UPLOAD_FAILED,
    ])))
)]
fn upload_publication_blob() {}

#[utoipa::path(
    post,
    path = "/v1/projects/{projectId}/publication-uploads/{publicationId}/complete",
    operation_id = "completePublicationUpload",
    tag = "Workspace",
    summary = "Publish an upload whose files are all stored.",
    description = "Takes an empty body. The attempt that became ready answers 201 on every completion; an attempt superseded by a ready publication of the same head and config answers 200 with that publication. Missing files answer 409 and an expired or closed attempt answers 410, after which the CLI plans again. See publication-upload-exchange.md.",
    params(
        ("projectId" = String, Path, format = "uuid"),
        ("publicationId" = String, Path, format = "uuid"),
    ),
    responses(
        (status = 200, description = "Another upload of the same head and config is the ready publication.", body = Receipt, content_type = "application/json"),
        (status = 201, description = "This upload became the ready publication.", body = Receipt, content_type = "application/json"),
        (status = "4XX", response = ErrorResponse),
        (status = "5XX", response = ErrorResponse),
    ),
    security(("projectToken" = [])),
    extensions(("x-reasons" = json!([
        reasons::INTERNAL_ERROR,
        reasons::NOT_FOUND,
        reasons::VALIDATION_FAILED,
        reasons::UPLOAD_INVALID_BUNDLE,
        reasons::UPLOAD_UNAUTHORIZED,
        reasons::UPLOAD_FORBIDDEN,
        reasons::UPLOAD_PLAN_REQUIRED,
        reasons::UPLOAD_UNAVAILABLE,
        reasons::UPLOAD_INCOMPLETE,
        reasons::UPLOAD_EXPIRED,
        reasons::UPLOAD_FAILED,
    ])))
)]
fn complete_publication_upload() {}
