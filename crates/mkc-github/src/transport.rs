//! Bounded reqwest transport and rate-limit waiting behind the HTTP trait.

use std::io::Read;
use std::sync::Arc;
use std::time::Duration;

use mkc_github_interface::credentials::{Clock, Sleeper};
use mkc_github_interface::error::{Error, ErrorResultExt, Result};
use mkc_github_interface::http::{Endpoint, Http, Method, Request, Response};
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use url::Url;

use crate::response;
use crate::response::ResponseFailure;

/// Factory allowing integration tests to select a local recorded HTTP server.
pub trait HttpFactory {
    /// Build a transport rooted at explicit API and OAuth origins.
    fn build(&self, api_origin: &str, web_origin: &str) -> Result<Arc<dyn Http>>;
}

/// Production reqwest transport factory; callers pass the official origins.
pub struct ReqwestFactory;

struct ReqwestHttp {
    client: Client,
    api: Url,
    web: Url,
}

impl HttpFactory for ReqwestFactory {
    fn build(&self, api_origin: &str, web_origin: &str) -> Result<Arc<dyn Http>> {
        Ok(Arc::new(ReqwestHttp {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .redirect(Policy::none())
                .user_agent("Mokly-Cloud-GitHub-App")
                .build()
                .context("build GitHub HTTP client")?,
            api: Url::parse(api_origin).context("parse GitHub API origin")?,
            web: Url::parse(web_origin).context("parse GitHub OAuth origin")?,
        }))
    }
}

impl Http for ReqwestHttp {
    fn send(&self, request: &Request) -> Result<Response> {
        let (base, path) = match &request.endpoint {
            Endpoint::Api(path) => (&self.api, path.as_str()),
            Endpoint::OAuthToken => (&self.web, "/login/oauth/access_token"),
        };
        let url = base.join(path).context("resolve GitHub endpoint")?;
        if url.origin() != base.origin() || !path.starts_with('/') || path.starts_with("//") {
            return Err(Error::InvalidRequest);
        }
        let method = match request.method {
            Method::Get => reqwest::Method::GET,
            Method::Post => reqwest::Method::POST,
            Method::Patch => reqwest::Method::PATCH,
        };
        let accept = if request.endpoint == Endpoint::OAuthToken {
            "application/json"
        } else {
            "application/vnd.github+json"
        };
        let mut builder = self
            .client
            .request(method, url)
            .header("Accept", accept)
            .header("X-GitHub-Api-Version", "2022-11-28");
        if let Some(token) = &request.bearer {
            builder = builder.bearer_auth(token.expose());
        }
        if let Some(body) = &request.body {
            builder = builder
                .header("Content-Type", "application/json")
                .body(body.clone());
        }
        let response = builder.send().context("send GitHub HTTP request")?;
        let status = response.status().as_u16();
        let headers = response
            .headers()
            .iter()
            .filter_map(|(name, value)| {
                value
                    .to_str()
                    .ok()
                    .map(|value| (name.as_str().to_owned(), value.to_owned()))
            })
            .collect();
        let mut body = Vec::new();
        response
            .take(8 * 1024 * 1024 + 1)
            .read_to_end(&mut body)
            .context("read GitHub response")?;
        if body.len() > 8 * 1024 * 1024 {
            return Err(Error::internal(ResponseFailure::Oversized));
        }
        Ok(Response {
            status,
            headers,
            body,
        })
    }
}

/// Retries one explicit rate-limit rejection, without replaying uncertain writes.
pub struct RetryingHttp {
    /// Underlying single-attempt transport.
    pub http: Arc<dyn Http>,
    /// Clock used to interpret GitHub's epoch reset header.
    pub clock: Arc<dyn Clock>,
    /// Wait boundary for a bounded retry.
    pub sleeper: Arc<dyn Sleeper>,
}

impl Http for RetryingHttp {
    fn send(&self, request: &Request) -> Result<Response> {
        for attempt in 0..2 {
            let response = self.http.send(request)?;
            if let Some(retry_after) =
                response::retry_after(&response, self.clock.now().timestamp())
            {
                if attempt == 0 && retry_after <= 60 {
                    self.sleeper.sleep(Duration::from_secs(retry_after));
                    continue;
                }
                return Err(Error::RateLimited { retry_after });
            }
            return response::checked(response);
        }
        Err(Error::Unavailable)
    }
}
