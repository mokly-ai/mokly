//! Bounded JSON API transport with injected OAuth credentials.

use std::future;
use std::io::{self, Read};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use bytes::Bytes;
use futures_util::StreamExt;
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_file_store_interface::stream::{BlobBody, ByteRange};
use reqwest::Method;
use reqwest::blocking::Client as BlockingClient;
use reqwest::header;
use reqwest::redirect::Policy;
use thiserror::Error;

use crate::deadline::{Clock, RequestBudget, SystemClock};
use crate::idle_timeout::IdleTimeout;

/// An authenticated request; bearer credentials are obtained at execution time.
pub struct Request {
    /// HTTP method.
    pub method: Method,
    /// Fully encoded JSON API endpoint.
    pub url: String,
    /// Exact uploaded bytes, absent on reads and deletes.
    pub body: Option<Bytes>,
    /// Inclusive response budget.
    pub response_limit: u64,
    /// Remaining time for credentials, request headers and the bounded body.
    pub timeout: Duration,
}

/// Bounded provider response, including non-success HTTP status.
#[derive(Debug)]
pub struct Response {
    /// Actual provider status; the adapter owns status interpretation.
    pub status: u16,
    /// Exact bounded response body.
    pub body: Vec<u8>,
}

/// An authenticated media read whose body must remain streaming.
pub struct StreamRequest {
    /// Fully encoded JSON API media endpoint.
    pub url: String,
    /// Validated inclusive range, absent for the complete object.
    pub range: Option<ByteRange>,
    /// Maximum bytes the returned reader can expose.
    pub response_limit: u64,
}

/// Provider media metadata and its bounded asynchronous response body.
pub struct StreamResponse {
    /// Actual provider status; the adapter owns status interpretation.
    pub status: u16,
    /// Parsed `Content-Length`, absent when missing or invalid.
    pub content_length: Option<u64>,
    /// Exact `Content-Range` value, absent when missing or invalid.
    pub content_range: Option<String>,
    /// Asynchronous media body bounded by the request's response limit.
    pub body: BlobBody,
}

/// HTTP seam for provider contract tests.
#[unimock::unimock(api = HttpMock)]
#[async_trait::async_trait]
pub trait Http: Send + Sync {
    /// Send one bounded request without following redirects.
    fn execute(&self, request: Request) -> Result<Response>;
    /// Open one bounded media response without buffering its body.
    async fn open(&self, request: StreamRequest) -> Result<StreamResponse>;
}

/// OAuth seam; production can refresh credentials before every request.
#[unimock::unimock(api = AccessTokenMock)]
pub trait AccessToken: Send + Sync {
    /// Obtain a current OAuth access token; never log the returned secret.
    fn token(&self, timeout: Duration) -> Result<String>;
}

/// Factory returning a transport rather than a concrete impure client.
pub trait HttpFactory {
    /// Construct a finite-timeout transport with a credential collaborator.
    fn build(&self, credentials: Arc<dyn AccessToken>) -> Result<Arc<dyn Http>>;
}

/// Production transport composition root.
pub struct ReqwestHttpFactory;

impl ReqwestHttpFactory {
    /// Construct the transport with an injected monotonic operation clock.
    pub fn build_with_clock(
        &self,
        credentials: Arc<dyn AccessToken>,
        clock: Arc<dyn Clock>,
    ) -> Result<Arc<dyn Http>> {
        let buffered_client = shared_blocking_client()?;
        let streaming_client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .redirect(Policy::none())
            .build()
            .context("build GCS streaming HTTP transport")?;
        Ok(Arc::new(ReqwestHttp {
            buffered_client,
            streaming_client,
            credentials,
            clock,
        }))
    }
}

struct ReqwestHttp {
    buffered_client: BlockingClient,
    streaming_client: reqwest::Client,
    credentials: Arc<dyn AccessToken>,
    clock: Arc<dyn Clock>,
}

impl HttpFactory for ReqwestHttpFactory {
    fn build(&self, credentials: Arc<dyn AccessToken>) -> Result<Arc<dyn Http>> {
        self.build_with_clock(credentials, Arc::new(SystemClock))
    }
}

fn shared_blocking_client() -> Result<BlockingClient> {
    static CLIENT: Mutex<Option<BlockingClient>> = Mutex::new(None);
    let mut shared = match CLIENT.lock() {
        Ok(shared) => shared,
        Err(_) => return Err(Error::internal(SharedClientLockPoisoned)),
    };
    if let Some(client) = shared.as_ref() {
        return Ok(client.clone());
    }
    let client = match thread::spawn(build_blocking_client).join() {
        Ok(client) => client?,
        Err(_) => return Err(Error::internal(BlockingClientBuildPanicked)),
    };
    *shared = Some(client.clone());
    Ok(client)
}

/// Build outside any async runtime: reqwest's blocking client creates and drops
/// a runtime during construction, which Tokio forbids on async worker threads.
fn build_blocking_client() -> Result<BlockingClient> {
    BlockingClient::builder()
        .timeout(Duration::from_secs(60))
        .connect_timeout(Duration::from_secs(10))
        .redirect(Policy::none())
        .build()
        .context("build GCS HTTP transport")
}

#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/transport] response exceeds budget")]
struct ResponseTooLarge;

/// A bounded buffered response retains its status without retaining the body.
#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/transport] response exceeds budget")]
pub(crate) struct BufferedResponseTooLarge {
    /// Provider status, needed when a missing seed object's error body is large.
    pub(crate) status: u16,
}

#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/transport] shared blocking client lock poisoned")]
struct SharedClientLockPoisoned;

#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/transport] blocking client construction thread panicked")]
struct BlockingClientBuildPanicked;

#[async_trait::async_trait]
impl Http for ReqwestHttp {
    fn execute(&self, request: Request) -> Result<Response> {
        let budget =
            RequestBudget::new(OperationDeadline::new(request.timeout), self.clock.clone())?;
        let token = self.credentials.token(budget.remaining()?)?;
        let mut builder = self
            .buffered_client
            .request(request.method, &request.url)
            .bearer_auth(token)
            .timeout(budget.remaining()?);
        if let Some(body) = request.body {
            builder = builder
                .header("Content-Type", "application/octet-stream")
                .body(body);
        }
        let response = builder.send().context("send GCS JSON API request")?;
        let status = response.status().as_u16();
        let mut body = Vec::new();
        response
            .take(request.response_limit + 1)
            .read_to_end(&mut body)
            .context("read GCS response")?;
        if body.len() as u64 > request.response_limit {
            return Err(Error::internal(BufferedResponseTooLarge { status }));
        }
        Ok(Response { status, body })
    }

    /// Fetch the token in one short blocking task, wait at most 60 seconds for
    /// the response headers, then bound the body by the request limit and the
    /// 60-second demand-started idle timeout; no deadline spans the whole body.
    async fn open(&self, request: StreamRequest) -> Result<StreamResponse> {
        let credentials = self.credentials.clone();
        let token = tokio::task::spawn_blocking(move || credentials.token(Duration::from_secs(5)))
            .await
            .context("join GCS access-token request")??;
        let mut builder = self.streaming_client.get(&request.url).bearer_auth(token);
        if let Some(range) = request.range {
            builder = builder.header(
                header::RANGE,
                format!("bytes={}-{}", range.start(), range.end()),
            );
        }
        let response = tokio::time::timeout(Duration::from_secs(60), builder.send())
            .await
            .context("wait for GCS media response headers")?
            .context("open GCS media response")?;
        let status = response.status().as_u16();
        let content_length = response
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse().ok());
        let content_range = response
            .headers()
            .get(header::CONTENT_RANGE)
            .and_then(|value| value.to_str().ok())
            .map(str::to_owned);
        let body = response
            .bytes_stream()
            .scan(request.response_limit, |remaining, item| {
                let item = match item {
                    Ok(bytes) if bytes.len() as u64 <= *remaining => {
                        *remaining -= bytes.len() as u64;
                        Ok(bytes)
                    }
                    Ok(_) => {
                        *remaining = 0;
                        Err(io::Error::other(ResponseTooLarge))
                    }
                    Err(error) => Err(io::Error::other(error)),
                };
                future::ready(Some(item))
            });
        Ok(StreamResponse {
            status,
            content_length,
            content_range,
            body: Box::pin(IdleTimeout::new(body, Duration::from_secs(60))),
        })
    }
}
