//! GitHub operation contracts.

use utoipa::OpenApi;

mod authentication;
mod installations;
mod webhooks;

#[derive(OpenApi)]
#[openapi(paths(
    authentication::start_github_sign_in,
    authentication::verify_github_sign_in,
    authentication::connect_github,
    authentication::disconnect_github,
    installations::complete_github_installation,
    installations::disconnect_github_installation,
    installations::list_installations,
    installations::install_github_app,
    installations::list_repositories,
    webhooks::receive_github_webhook,
))]
pub(super) struct Doc;
