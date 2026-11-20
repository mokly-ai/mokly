//! GitHub webhooks operation contracts.

#![expect(
    dead_code,
    reason = "Contract stubs describe operations executed by the dispatcher."
)]

use super::super::bodies::GitHubEvent;
use super::super::reasons;
use super::super::responses::ErrorResponse;

#[utoipa::path(
    post,
    path = "/v1/github/webhooks",
    operation_id = "receiveGitHubWebhook",
    tag = "GitHub",
    summary = "Accept a signed GitHub delivery.",
    params(
        ("X-GitHub-Delivery" = String, Header),
        ("X-GitHub-Event" = String, Header),
        ("X-Hub-Signature-256" = String, Header),
    ),
    request_body(content = inline(GitHubEvent), content_type = "application/json"),
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
fn receive_github_webhook() {}
