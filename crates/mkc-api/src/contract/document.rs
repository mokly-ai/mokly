//! Root OpenAPI document, assembled from the area contracts in stable order.

use utoipa::{Modify, OpenApi};

use super::metadata::{DeferredOperations, Metadata};
use super::responses::ErrorResponse;
use super::session_cookie::SessionCookie;
use super::{
    account, approvals, billing, builds, catalogue_access, comments, github, grants, health,
    members, projects, publications, tokens, uploads, workspaces,
};

/// Root metadata for the complete Rust-owned HTTP contract.
#[derive(OpenApi)]
#[openapi(
    info(title = "Mokly Cloud product API", version = "0.1.0", description = "Platform API with explicit 503 responses for deferred publication and review operations. Browser credentials land at /auth/email/callback, /auth/preview/callback, /auth/github/callback or /auth/github/install; the /v1 callback operations below remain on the API origin. See the REST and authentication protocols. Screen selections use entry paths with the Mokly segment grammar."),
    servers((url = "/")),
    tags(
        (name = "Health", description = "Public process identity and database readiness."),
        (name = "Account", description = "Sessions, identity and installation selection."),
        (name = "Workspace", description = "Workspaces, projects, settings, billing and publications."),
        (name = "Review", description = "Screen threads and publication approvals."),
    ),
    security(("session" = [])),
    components(responses(ErrorResponse)),
    modifiers(&Metadata)
)]
struct Root;

/// Complete document shared by router construction, CLI output and contract tests.
pub struct ApiDoc;

impl OpenApi for ApiDoc {
    fn openapi() -> utoipa::openapi::OpenApi {
        let mut document = Root::openapi();
        for area in [
            health::Doc::openapi(),
            account::Doc::openapi(),
            github::Doc::openapi(),
            workspaces::Doc::openapi(),
            members::Doc::openapi(),
            projects::Doc::openapi(),
            tokens::Doc::openapi(),
            grants::Doc::openapi(),
            builds::Doc::openapi(),
            publications::Doc::openapi(),
            uploads::Doc::openapi(),
            catalogue_access::Doc::openapi(),
            billing::Doc::openapi(),
            comments::Doc::openapi(),
            approvals::Doc::openapi(),
        ] {
            document.merge(area);
        }
        DeferredOperations.modify(&mut document);
        SessionCookie.modify(&mut document);
        document
    }
}
