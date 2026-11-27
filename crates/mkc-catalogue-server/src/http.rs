//! Bounded catalogue HTTP adapter with exact-origin grant exchange.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use axum::body::to_bytes;
use axum::extract::Request;
use axum::http::{HeaderMap, HeaderName, Method, header};
use axum::response::Response;
use mkc_domain::client_origins::AdmittedOrigins;
use serde::Deserialize;

use crate::catalogue::{self, Catalogue};
use crate::error::{Error, ErrorResultExt, Result};
use crate::response;

pub(crate) trait Handler: Send + Sync {
    fn handle(&self, request: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>>;
}

pub(crate) struct CatalogueHandler {
    pub(crate) catalogue: Arc<dyn Catalogue>,
    pub(crate) origins: AdmittedOrigins,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GrantBody {
    grant: String,
}

trait Dispatch {
    async fn dispatch(&self, request: Request) -> Result<Response>;
}

impl Handler for CatalogueHandler {
    fn handle(&self, request: Request) -> Pin<Box<dyn Future<Output = Response> + Send + '_>> {
        Box::pin(async move {
            match self.dispatch(request).await {
                Ok(response) => response,
                Err(error) => response::failure(error),
            }
        })
    }
}

impl Dispatch for CatalogueHandler {
    async fn dispatch(&self, request: Request) -> Result<Response> {
        let (parts, body) = request.into_parts();
        if parts.headers.get_all(header::HOST).iter().count() != 1 {
            return Err(Error::NotFound);
        }
        let field = |name| {
            parts
                .headers
                .get(name)
                .and_then(|value| value.to_str().ok())
        };
        let host = field(header::HOST).ok_or(Error::NotFound)?.to_owned();
        let catalogue = self.catalogue.clone();
        if parts.uri.path() == "/_access" {
            if parts.method != Method::POST
                || parts.uri.query().is_some()
                || field(header::CONTENT_TYPE) != Some("application/json")
            {
                return Err(Error::InvalidRequest);
            }
            if self.origins.classify(field(header::ORIGIN)).is_none() {
                return Err(Error::Forbidden);
            }
            let bytes =
                match tokio::time::timeout(Duration::from_secs(10), to_bytes(body, 1024)).await {
                    Ok(Ok(bytes)) => bytes,
                    _ => return Err(Error::InvalidRequest),
                };
            let grant: GrantBody = match serde_json::from_slice(&bytes) {
                Ok(grant) => grant,
                Err(_) => return Err(Error::InvalidRequest),
            };
            let token =
                tokio::task::spawn_blocking(move || catalogue.exchange(&host, &grant.grant))
                    .await
                    .context("dispatch catalogue grant exchange")??;
            return response::exchanged(&token);
        }
        if parts.method != Method::GET && parts.method != Method::HEAD {
            return Err(Error::InvalidRequest);
        }
        let iframe_navigation = parts.method == Method::GET
            && field(HeaderName::from_static("sec-fetch-mode")) == Some("navigate")
            && field(HeaderName::from_static("sec-fetch-dest")) == Some("iframe");
        let range = joined_header(&parts.headers, header::RANGE);
        let if_none_match = joined_header(&parts.headers, header::IF_NONE_MATCH);
        let accept_encoding = joined_header(&parts.headers, header::ACCEPT_ENCODING);
        let request = catalogue::Request {
            host,
            path: parts.uri.path().to_owned(),
            query: parts.uri.query().map(str::to_owned),
            cookie_header: parts.headers.get(header::COOKIE).cloned(),
            bearer: bearer(&parts.headers).map(str::to_owned),
            iframe_navigation,
            range,
            if_range: parts.headers.contains_key(header::IF_RANGE),
            if_none_match,
            head: parts.method == Method::HEAD,
        };
        let serving = catalogue.clone();
        let (served, clear_cookie) = tokio::task::spawn_blocking(move || {
            let mut clear_cookie = false;
            let served = serving.serve(request, &mut clear_cookie);
            (served, clear_cookie)
        })
        .await
        .context("dispatch catalogue file request")?;
        let mut response = match served {
            Ok(served) => {
                match response::render(served, accept_encoding.as_deref(), catalogue.as_ref()).await
                {
                    Ok(response) => response,
                    Err(error) => response::failure(error),
                }
            }
            Err(error) => response::failure(error),
        };
        if clear_cookie {
            response::clear_cookie(&mut response);
        }
        Ok(response)
    }
}

fn bearer(headers: &HeaderMap) -> Option<&str> {
    let authorization = headers.get_all(header::AUTHORIZATION);
    let mut values = authorization.iter();
    let value = values.next()?.to_str().ok()?;
    if values.next().is_some() {
        return None;
    }
    let (scheme, credential) = value.split_once(' ')?;
    let token = credential.trim_start_matches(' ');
    let stem = token.trim_end_matches('=');
    (scheme.eq_ignore_ascii_case("bearer")
        && !stem.is_empty()
        && stem.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~' | b'+' | b'/')
        }))
    .then_some(token)
}

fn joined_header(headers: &HeaderMap, name: HeaderName) -> Option<String> {
    let mut joined = String::new();
    for value in headers.get_all(name).iter() {
        let value = value.to_str().ok()?;
        if !joined.is_empty() {
            joined.push(',');
        }
        joined.push_str(value);
    }
    (!joined.is_empty()).then_some(joined)
}

#[cfg(test)]
#[path = "_tests_/http/mod.rs"]
mod tests;
