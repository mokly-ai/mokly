//! Postmark's documented single-email HTTP transport.

use std::sync::Arc;
use std::time::Duration;

use mkc_email_interface::mail::{Error, ErrorResultExt, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use crate::model::TemplateModel;

/// Hosted-template send request; field spelling matches Postmark's API.
#[derive(Serialize)]
#[serde(rename_all = "PascalCase")]
pub struct Email {
    /// Verified sending identity.
    pub from: String,
    /// Exactly one validated recipient.
    pub to: String,
    /// Alias synchronized before the API rollout.
    pub template_alias: &'static str,
    /// Typed values applied to the hosted subject and both bodies.
    pub template_model: TemplateModel,
    /// Preserve the email's mobile and dark media queries.
    pub inline_css: bool,
    /// Transactional message stream.
    pub message_stream: String,
    /// Disabled for authentication links.
    pub track_opens: bool,
    /// Disabled to avoid credential-bearing tracking URLs.
    pub track_links: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct Reply {
    error_code: u32,
}

#[derive(Debug, thiserror::Error)]
enum Rejected {
    #[error(
        "[mkc-email-postmark/transport] provider rejected delivery: HTTP {status}, code {code}"
    )]
    Provider { status: u16, code: u32 },
}

/// HTTP behavior isolated from product message formatting.
pub trait Transport: Send + Sync {
    /// Submit a message and validate both HTTP status and provider error code.
    fn send(&self, email: &Email) -> Result<()>;
}

/// Constructs a pooled transport once at the composition root.
pub trait TransportFactory {
    /// Build a reusable client with bounded requests and no redirects.
    fn build(&self, endpoint: String, server_token: String) -> Result<Arc<dyn Transport>>;
}

/// Native Postmark HTTP client factory.
pub struct PostmarkHttpFactory;

impl TransportFactory for PostmarkHttpFactory {
    fn build(&self, endpoint: String, server_token: String) -> Result<Arc<dyn Transport>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .context("create mail transport")?;
        Ok(Arc::new(PostmarkHttp {
            endpoint,
            server_token,
            client,
        }))
    }
}

struct PostmarkHttp {
    endpoint: String,
    server_token: String,
    client: Client,
}

impl Transport for PostmarkHttp {
    fn send(&self, email: &Email) -> Result<()> {
        let response = self
            .client
            .post(&self.endpoint)
            .header("Accept", "application/json")
            .header("X-Postmark-Server-Token", &self.server_token)
            .json(email)
            .send()
            .context("send mail")?;
        let status = response.status();
        let reply: Reply = response.json().context("decode mail response")?;
        if !status.is_success() || reply.error_code != 0 {
            return Err(Error::internal(Rejected::Provider {
                status: status.as_u16(),
                code: reply.error_code,
            }));
        }
        Ok(())
    }
}
