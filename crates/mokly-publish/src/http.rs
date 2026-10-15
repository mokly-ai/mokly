//! HTTP request boundary and a bounded reqwest/rustls adapter.

use std::time::Duration;

use bytes::Bytes;
use futures_util::future::BoxFuture;
use reqwest::header::{
    ACCEPT, AUTHORIZATION, CONTENT_LENGTH, CONTENT_TYPE, HeaderValue, RETRY_AFTER,
};
use reqwest::{Client, Method, redirect, retry};
use thiserror::Error;
use url::Url;

use crate::settings::Token;
use crate::validation::RESPONSE_LIMIT;

/// Protocol request kind determines method and fixed headers.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Step {
    /// POST the gzip tar to the exact configured endpoint.
    Plan,
    /// PUT one exact content-addressed blob.
    Blob,
    /// POST with no body to complete the upload.
    Complete,
}

/// A prepared request. Its URL is checked again before every attempt.
#[derive(Clone)]
pub struct Request {
    /// Exchange step.
    pub step: Step,
    /// Absolute same-origin target.
    pub url: Url,
    /// Immutable request snapshot; empty for Complete.
    pub body: Bytes,
    /// At most 120 seconds, shortened at upload expiry.
    pub timeout: Duration,
}

/// Bounded response-body outcome after a known HTTP status.
#[derive(Clone, Debug)]
pub enum Body {
    /// Complete response bytes within the read limit.
    Bytes(Bytes),
    /// The read exceeded 16 MiB.
    Oversized,
    /// A known status had an interrupted or unusable body.
    Unreadable,
}

/// Only headers needed by the protocol survive this boundary.
#[derive(Clone, Debug)]
pub struct Response {
    /// HTTP status, classified independently of response text.
    pub status: u16,
    /// Content-Type, used only for Plan and optional Complete viewer URL.
    pub content_type: Option<String>,
    /// Retry-After, used only for retryable statuses.
    pub retry_after: Option<String>,
    /// Bounded body read result.
    pub body: Body,
}

/// No underlying exception, URL, header, or credential is printable.
#[derive(Clone, Debug, Error)]
pub enum TransportError {
    /// No known HTTP result was obtained. The underlying exception is private.
    #[error("[mokly-publish/http] request transport failed")]
    Failed,
}

/// One HTTP attempt. The caller owns retries, expiry, and cancellation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = HttpMock))]
pub trait Http: Send + Sync {
    /// Send one request without redirects or automatic retries.
    /// Honor request.timeout through the body read; dropping the future cancels the attempt.
    fn send<'a>(
        &'a self,
        request: &'a Request,
        token: &'a Token,
    ) -> BoxFuture<'a, std::result::Result<Response, TransportError>>;
}

/// Host HTTP adapter; no cookies, decompression, or implicit retries.
pub struct ReqwestHttp {
    client: Client,
}

impl ReqwestHttp {
    /// Construct once at the composition root with rustls certificate verification.
    pub fn new() -> std::result::Result<Self, TransportError> {
        match Client::builder()
            .redirect(redirect::Policy::none())
            .retry(retry::never())
            .referer(false)
            .timeout(Duration::from_secs(120))
            .build()
        {
            Ok(client) => Ok(Self { client }),
            Err(_) => Err(TransportError::Failed),
        }
    }
}

impl Http for ReqwestHttp {
    fn send<'a>(
        &'a self,
        request: &'a Request,
        token: &'a Token,
    ) -> BoxFuture<'a, std::result::Result<Response, TransportError>> {
        Box::pin(async move {
            let Ok(mut authorization) =
                HeaderValue::from_str(&format!("Bearer {}", token.expose()))
            else {
                return Err(TransportError::Failed);
            };
            authorization.set_sensitive(true);
            let method = if request.step == Step::Blob {
                Method::PUT
            } else {
                Method::POST
            };
            let mut outgoing = self
                .client
                .request(method, request.url.clone())
                .header(AUTHORIZATION, authorization)
                .header(CONTENT_LENGTH, request.body.len())
                .timeout(request.timeout);
            outgoing = match request.step {
                Step::Plan => outgoing
                    .header(CONTENT_TYPE, "application/gzip")
                    .header(ACCEPT, "application/json"),
                Step::Blob => outgoing.header(CONTENT_TYPE, "application/octet-stream"),
                Step::Complete => outgoing.header(ACCEPT, "application/json"),
            };
            let Ok(mut incoming) = outgoing.body(request.body.clone()).send().await else {
                return Err(TransportError::Failed);
            };
            let mut response = Response {
                status: incoming.status().as_u16(),
                content_type: incoming
                    .headers()
                    .get(CONTENT_TYPE)
                    .and_then(|value| value.to_str().ok())
                    .map(str::to_owned),
                retry_after: incoming
                    .headers()
                    .get(RETRY_AFTER)
                    .and_then(|value| value.to_str().ok())
                    .map(str::to_owned),
                body: Body::Bytes(Bytes::new()),
            };
            if request.step == Step::Blob || !matches!(response.status, 200 | 201) {
                return Ok(response);
            }
            if incoming
                .content_length()
                .is_some_and(|length| length > RESPONSE_LIMIT as u64)
            {
                response.body = Body::Oversized;
                return Ok(response);
            }
            let mut bytes = Vec::new();
            loop {
                match incoming.chunk().await {
                    Ok(Some(chunk))
                        if chunk.len() <= RESPONSE_LIMIT.saturating_sub(bytes.len()) =>
                    {
                        bytes.extend_from_slice(&chunk)
                    }
                    Ok(Some(_)) => {
                        response.body = Body::Oversized;
                        break;
                    }
                    Ok(None) => {
                        response.body = Body::Bytes(bytes.into());
                        break;
                    }
                    Err(_) => {
                        response.body = Body::Unreadable;
                        break;
                    }
                }
            }
            Ok(response)
        })
    }
}

pub(crate) fn is_json(content_type: Option<&str>) -> bool {
    content_type.is_some_and(|value| {
        value
            .split(';')
            .next()
            .is_some_and(|media| media.trim().eq_ignore_ascii_case("application/json"))
    })
}
