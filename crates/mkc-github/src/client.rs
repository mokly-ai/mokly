//! Trait-backed provider client shared by repository, check and identity adapters.

use std::sync::Arc;

use mkc_github_interface::credentials::{AppJwt, Secret, Tokens};
use mkc_github_interface::error::{Error, ErrorResultExt, Result};
use mkc_github_interface::http::{Endpoint, Http, Method, Request, Response};
use serde::Serialize;

use crate::response;

/// OAuth configuration; secret values deliberately have no Debug representation.
pub struct OAuthSettings {
    /// Registered GitHub App client ID.
    pub client_id: String,
    /// App client secret.
    pub client_secret: Secret,
    /// Exact registered callback on the app origin.
    pub redirect_uri: String,
}

/// Concrete implementation composed once and consumed through provider traits.
pub struct GitHub {
    /// HTTP transport, including explicit rate-limit retry policy.
    pub http: Arc<dyn Http>,
    /// Installation token manager.
    pub tokens: Arc<dyn Tokens>,
    /// App signing boundary.
    pub jwt: Arc<dyn AppJwt>,
    /// User token exchange settings.
    pub oauth: OAuthSettings,
}

impl GitHub {
    pub(crate) fn installed(
        &self,
        installation: i64,
        method: Method,
        path: String,
        body: Option<String>,
    ) -> Result<Response> {
        if installation <= 0 {
            return Err(Error::InvalidRequest);
        }
        let mut request = Request {
            method,
            endpoint: Endpoint::Api(path),
            bearer: Some(self.tokens.get(installation)?),
            body,
        };
        let first = self.http.send(&request).and_then(response::checked);
        match first {
            Err(Error::Unauthorized) => {
                self.tokens.invalidate(installation)?;
                request.bearer = Some(self.tokens.get(installation)?);
                response::checked(self.http.send(&request)?)
            }
            other => other,
        }
    }

    pub(crate) fn user_request(&self, token: &Secret, path: String) -> Result<Response> {
        response::checked(self.http.send(&Request {
            method: Method::Get,
            endpoint: Endpoint::Api(path),
            bearer: Some(token.clone()),
            body: None,
        })?)
    }
}

pub(crate) fn repository_path(repository: &str) -> Result<String> {
    let parts: Vec<_> = repository.split('/').collect();
    if parts.len() != 2 || parts.iter().any(|part| !valid_name(part)) {
        return Err(Error::InvalidRequest);
    }
    Ok(format!("/repos/{repository}"))
}

pub(crate) fn valid_name(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte))
}

pub(crate) fn json<T: Serialize>(value: &T) -> Result<Option<String>> {
    Ok(Some(
        serde_json::to_string(value).context("encode GitHub request")?,
    ))
}
