//! Recorded HTTP boundary without coupling consumers to reqwest.

use std::collections::BTreeMap;

use crate::credentials::Secret;
use crate::error::Result;

/// Supported Stripe request methods.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Method {
    /// Fetch a resource.
    Get,
    /// Create or update a resource.
    Post,
    /// Delete a resource.
    Delete,
}

/// Form-encoded provider request; deliberately excluded from Debug.
#[derive(Clone)]
pub struct Request {
    /// HTTP verb.
    pub method: Method,
    /// Relative Stripe API path beginning with `/v1/`.
    pub path: String,
    /// Bearer credential used only by the transport.
    pub bearer: Secret,
    /// Caller or adapter derived replay key for writes.
    pub idempotency_key: Option<String>,
    /// URL-encoded query fields for reads or body fields for writes.
    pub form: Vec<(String, String)>,
}

/// Bounded provider response with lowercase header names.
#[derive(Clone, Debug)]
pub struct Response {
    /// HTTP status code.
    pub status: u16,
    /// Provider response headers normalized to lowercase.
    pub headers: BTreeMap<String, String>,
    /// Original response bytes, decoded into typed DTOs immediately by callers.
    pub body: Vec<u8>,
}

/// HTTP transport seam used by every billing-provider operation.
#[unimock::unimock(api = HttpMock)]
pub trait Http: Send + Sync {
    /// Send one bounded request while preserving transport failures internally.
    fn send(&self, request: &Request) -> Result<Response>;
}
