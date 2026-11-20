//! Recorded HTTP boundary without coupling consumers to reqwest.

use std::collections::BTreeMap;

use crate::credentials::Secret;
use crate::error::Result;

/// Supported GitHub REST request methods.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Method {
    /// Fetch a resource.
    Get,
    /// Create a resource or request an action.
    Post,
    /// Update a resource.
    Patch,
}

/// Fixed provider origin plus an escaped relative API path.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Endpoint {
    /// GitHub REST API path, optionally with pagination query parameters.
    Api(String),
    /// GitHub's web OAuth token exchange endpoint.
    OAuthToken,
}

/// HTTP request whose body may contain a credential; deliberately not Debug.
#[derive(Clone)]
pub struct Request {
    /// REST verb.
    pub method: Method,
    /// Destination on a configured provider origin.
    pub endpoint: Endpoint,
    /// Optional bearer credential.
    pub bearer: Option<Secret>,
    /// JSON encoded from a typed boundary DTO.
    pub body: Option<String>,
}

/// Bounded provider response; headers are normalized to lowercase.
#[derive(Clone, Debug)]
pub struct Response {
    /// HTTP status code.
    pub status: u16,
    /// Rate-limit, retry and pagination metadata.
    pub headers: BTreeMap<String, String>,
    /// Original response bytes, decoded into typed DTOs immediately by callers.
    pub body: Vec<u8>,
}

/// HTTP transport seam used by every provider operation.
#[unimock::unimock(api = HttpMock)]
pub trait Http: Send + Sync {
    /// Send one request; transport errors preserve their underlying source.
    fn send(&self, request: &Request) -> Result<Response>;
}
