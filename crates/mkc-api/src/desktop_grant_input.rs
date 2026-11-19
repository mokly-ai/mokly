//! Strict desktop grant request bodies owned by the API contract.

use serde::Deserialize;
use utoipa::ToSchema;

/// Browser authorization of a desktop verifier and application destination.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DesktopGrantRequest {
    /// Base64url S256 challenge of the desktop window's 64-hex verifier.
    #[schema(min_length = 43, max_length = 43, pattern = "^[A-Za-z0-9_-]{43}$")]
    pub(crate) challenge: String,
    /// Application destination, normalized to `/dashboard` when rejected or absent.
    #[schema(nullable = false)]
    pub(crate) return_to: Option<String>,
}

/// One-use credential paired with the verifier kept by the desktop window.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct DesktopGrantCallback {
    /// One-use grant delivered through the desktop scheme.
    #[schema(min_length = 64, max_length = 64, pattern = "^[a-f0-9]{64}$")]
    pub(crate) grant: String,
    /// Window-held verifier whose text produces the stored S256 challenge.
    #[schema(min_length = 64, max_length = 64, pattern = "^[a-f0-9]{64}$")]
    pub(crate) verifier: String,
}
