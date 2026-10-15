//! Completion classification and optional normalized, secret-free viewer URLs.

use mokly_model::output::validation::RESPONSE_LIMIT;
use serde::Deserialize;
use url::Url;

use crate::error::{Error, Result};
use crate::http::{Body, Response, is_json};
use crate::settings::Token;

/// Receiver's keep-first publication outcome.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Outcome {
    /// This upload created the first publication.
    Published,
    /// A different upload already published this revision and configuration.
    AlreadyPublished,
}

/// Successful completion does not depend on an optional body.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Completion {
    /// Whether the counted summary or keep-first summary is used.
    pub outcome: Outcome,
    /// Normalized absolute HTTP(S) URL, absent when unusable or secret-bearing.
    pub viewer_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Viewer {
    viewer_url: Option<String>,
}

impl Completion {
    /// Classify a known response status, independently of optional body errors.
    pub fn parse(response: &Response, token: &Token) -> Result<Self> {
        let outcome = match response.status {
            201 => Outcome::Published,
            200 => Outcome::AlreadyPublished,
            409 | 410 => return Err(Error::Replan),
            status => {
                rejection(status)?;
                return Err(Error::Failed);
            }
        };
        let viewer_url = viewer(response, token);
        Ok(Self {
            outcome,
            viewer_url,
        })
    }
}

fn viewer(response: &Response, token: &Token) -> Option<String> {
    if !is_json(response.content_type.as_deref()) {
        return None;
    }
    let Body::Bytes(bytes) = &response.body else {
        return None;
    };
    if bytes.len() > RESPONSE_LIMIT {
        return None;
    }
    let document = serde_json::from_slice::<Viewer>(bytes).ok()?;
    let url = Url::parse(&document.viewer_url?).ok()?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || token.appears_in(url.as_str())
    {
        return None;
    }
    Some(url.into())
}

/// Status classification never reads a rejection body or headers.
pub fn rejection(status: u16) -> Result<()> {
    match status {
        400 | 422 => Err(Error::InvalidBundle),
        413 => Err(Error::TooLarge),
        401 | 403 => Err(Error::Unauthorized),
        426 => Err(Error::UnsupportedVersion),
        _ => Err(Error::Failed),
    }
}

/// Only these statuses can consume the request's five-attempt budget.
pub fn retryable(status: u16) -> bool {
    matches!(status, 408 | 429 | 500 | 502 | 503 | 504)
}
