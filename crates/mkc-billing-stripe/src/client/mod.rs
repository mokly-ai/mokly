//! Typed Stripe requests over the injected HTTP boundary.

use std::sync::Arc;

use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::http::Http;

mod billing;
pub(crate) mod catalogue;
mod failure;
pub(crate) mod form;
mod request;
mod validation;

/// Stripe implementation composed once and consumed through provider traits.
pub struct StripeClient {
    /// HTTP transport, normally including bounded rate-limit retry policy.
    pub http: Arc<dyn Http>,
    /// Restricted or secret Stripe API key.
    pub key: Secret,
}
