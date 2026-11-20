//! Bounded reqwest transport and explicit rate-limit waiting.

use std::io::Read;
use std::sync::Arc;
use std::time::Duration;

use mkc_billing_interface::credentials::Sleeper;
use mkc_billing_interface::error::{Error, ErrorResultExt, Result};
use mkc_billing_interface::http::{Http, Method, Request, Response};
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use url::{Url, form_urlencoded};

use crate::response;
use crate::response::ResponseFailure;

/// Stripe API version pinned by the billing protocol.
pub const STRIPE_VERSION: &str = "2026-08-26.dahlia";

/// Request deadline for ordinary provider operations.
pub const OPERATION_TIMEOUT: Duration = Duration::from_secs(30);

/// Per-price startup verification deadline.
pub const VERIFICATION_TIMEOUT: Duration = Duration::from_secs(5);

const MAX_BODY_BYTES: u64 = 1024 * 1024;

/// Factory allowing composition roots to select the configured Stripe origin.
#[unimock::unimock(api = HttpFactoryMock)]
pub trait HttpFactory: Send + Sync {
    /// Build a bounded transport rooted at one exact API origin.
    fn build(&self, api_origin: &str, timeout: Duration) -> Result<Arc<dyn Http>>;
}

/// Production reqwest transport factory.
pub struct ReqwestFactory;

pub(crate) struct ReqwestHttp {
    client: Client,
    api: Url,
    timeout: Duration,
}

impl ReqwestHttp {
    fn new(api_origin: &str, timeout: Duration) -> Result<Self> {
        let api = match Url::parse(api_origin) {
            Ok(api) => api,
            Err(_) => return Err(Error::invalid_request()),
        };
        if !matches!(api.scheme(), "http" | "https")
            || api.host_str().is_none()
            || !api.username().is_empty()
            || api.password().is_some()
            || api.path() != "/"
            || api.query().is_some()
            || api.fragment().is_some()
        {
            return Err(Error::invalid_request());
        }
        Ok(Self {
            client: Client::builder()
                .timeout(timeout)
                .redirect(Policy::none())
                .user_agent("Mokly-Cloud-Billing")
                .build()
                .context("build Stripe HTTP client")?,
            api,
            timeout,
        })
    }

    pub(crate) fn prepare(&self, request: &Request) -> Result<reqwest::blocking::Request> {
        if !request.path.starts_with("/v1/")
            || request.path.starts_with("//")
            || request.path.contains(['?', '#'])
        {
            return Err(Error::invalid_request());
        }
        let mut url = self
            .api
            .join(&request.path)
            .context("resolve Stripe endpoint")?;
        if url.origin() != self.api.origin() || !url.path().starts_with("/v1/") {
            return Err(Error::invalid_request());
        }
        let encoded = encode_form(&request.form);
        if request.method == Method::Get && !encoded.is_empty() {
            url.set_query(Some(&encoded));
        }
        let method = match request.method {
            Method::Get => reqwest::Method::GET,
            Method::Post => reqwest::Method::POST,
            Method::Delete => reqwest::Method::DELETE,
        };
        let mut builder = self
            .client
            .request(method, url)
            .timeout(self.timeout)
            .bearer_auth(request.bearer.expose())
            .header("User-Agent", "Mokly-Cloud-Billing")
            .header("Stripe-Version", STRIPE_VERSION);
        if let Some(key) = &request.idempotency_key {
            builder = builder.header("Idempotency-Key", key);
        }
        if request.method != Method::Get {
            builder = builder
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(encoded);
        }
        builder.build().context("build Stripe HTTP request")
    }
}

impl HttpFactory for ReqwestFactory {
    fn build(&self, api_origin: &str, timeout: Duration) -> Result<Arc<dyn Http>> {
        Ok(Arc::new(ReqwestHttp::new(api_origin, timeout)?))
    }
}

impl Http for ReqwestHttp {
    fn send(&self, request: &Request) -> Result<Response> {
        let response = self
            .client
            .execute(self.prepare(request)?)
            .context("send Stripe HTTP request")?;
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.as_str().to_ascii_lowercase(), value.to_owned()))
            })
            .collect();
        let mut body = Vec::new();
        response
            .take(MAX_BODY_BYTES + 1)
            .read_to_end(&mut body)
            .context("read Stripe response")?;
        if body.len() as u64 > MAX_BODY_BYTES {
            return Err(Error::internal(ResponseFailure::Oversized));
        }
        Ok(Response {
            status,
            headers,
            body,
        })
    }
}

/// Retries one explicit Stripe rate-limit response after a bounded delay.
pub struct RetryingHttp {
    /// Underlying single-attempt transport.
    pub http: Arc<dyn Http>,
    /// Wait boundary for the bounded retry.
    pub sleeper: Arc<dyn Sleeper>,
}

impl Http for RetryingHttp {
    fn send(&self, request: &Request) -> Result<Response> {
        for attempt in 0..2 {
            let response = self.http.send(request)?;
            if response.status == 429 {
                let retry_after = response::retry_after(&response);
                if attempt == 0 && retry_after <= 60 {
                    self.sleeper.sleep(Duration::from_secs(retry_after));
                    continue;
                }
            }
            return response::checked(response);
        }
        Err(Error::Unavailable)
    }
}

pub(crate) fn encode_form(form: &[(String, String)]) -> String {
    let mut serializer = form_urlencoded::Serializer::new(String::new());
    for (key, value) in form {
        serializer.append_pair(key, value);
    }
    serializer.finish()
}

#[cfg(test)]
pub(crate) fn reqwest_http(api_origin: &str, timeout: Duration) -> Result<ReqwestHttp> {
    ReqwestHttp::new(api_origin, timeout)
}
