//! Typed response decoding and explicit HTTP failure classification.

use mkc_github_interface::error::{Error, ErrorResultExt, Result};
use mkc_github_interface::http::Response;
use serde::Deserialize;
use serde::de::DeserializeOwned;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum ResponseFailure {
    #[error("[mkc-github/response] unexpected HTTP status: {0}")]
    Status(u16),
    #[error("[mkc-github/response] body exceeds eight MiB")]
    Oversized,
}

#[derive(Deserialize)]
struct Failure {
    documentation_url: Option<String>,
}

pub(crate) fn decode<T: DeserializeOwned>(response: Response) -> Result<T> {
    let response = checked(response)?;
    serde_json::from_slice(&response.body).context("decode GitHub response")
}

pub(crate) fn checked(response: Response) -> Result<Response> {
    match response.status {
        200..=299 => Ok(response),
        401 => Err(Error::Unauthorized),
        403 => Err(Error::Forbidden),
        404 => Err(Error::NotFound),
        429 => Err(Error::RateLimited { retry_after: 60 }),
        500..=599 => Err(Error::Unavailable),
        status @ 400..=499 => Err(Error::Http { status }),
        status => Err(Error::internal(ResponseFailure::Status(status))),
    }
}

pub(crate) fn retry_after(response: &Response, now: i64) -> Option<u64> {
    if !matches!(response.status, 403 | 429) {
        return None;
    }
    let header = |key: &str| {
        response
            .headers
            .get(key)
            .and_then(|value| value.parse::<u64>().ok())
    };
    let exhausted = header("x-ratelimit-remaining") == Some(0);
    let secondary = serde_json::from_slice::<Failure>(&response.body)
        .ok()
        .and_then(|failure| failure.documentation_url)
        .is_some_and(|url| matches!(url.as_str(),
            "https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits"
            | "https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits"
            | "https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api#about-secondary-rate-limits"));
    let retry = header("retry-after");
    if response.status != 429 && !exhausted && !secondary && retry.is_none() {
        return None;
    }
    let reset = if exhausted {
        header("x-ratelimit-reset").map(|reset| reset.saturating_sub(now.max(0) as u64).max(1))
    } else {
        None
    };
    Some(
        retry
            .unwrap_or_else(|| if reset.is_some() { 1 } else { 60 })
            .max(reset.unwrap_or(1))
            .max(1),
    )
}
