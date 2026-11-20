//! Workload-identity access tokens from Google's instance metadata endpoint.

use std::io::Read;
use std::sync::Arc;
use std::time::Duration;

use mkc_file_store_interface::error::{Error, ErrorResultExt, Result};
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use serde::Deserialize;
use thiserror::Error;

use crate::transport::AccessToken;

/// Composition boundary for renewable workload identity credentials.
pub trait CredentialsFactory {
    /// Construct a metadata adapter; credentials are acquired only on requests.
    fn metadata(&self) -> Result<Arc<dyn AccessToken>>;
}

/// GCE/GKE workload-identity metadata composition root.
pub struct MetadataCredentialsFactory;

struct MetadataCredentials {
    client: Client,
}

#[derive(Deserialize)]
struct Token {
    access_token: String,
    token_type: String,
    expires_in: u64,
}

#[derive(Debug, Error)]
#[error("[mkc-file-store-gcs/credentials] invalid workload identity response")]
struct InvalidCredentials;

impl CredentialsFactory for MetadataCredentialsFactory {
    fn metadata(&self) -> Result<Arc<dyn AccessToken>> {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .redirect(Policy::none())
            .no_proxy()
            .build()
            .context("initialize metadata credential client")?;
        Ok(Arc::new(MetadataCredentials { client }))
    }
}

impl AccessToken for MetadataCredentials {
    fn token(&self, timeout: Duration) -> Result<String> {
        let response = self.client.get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token")
            .header("Metadata-Flavor", "Google")
            .timeout(timeout.min(Duration::from_secs(5)))
            .send()
            .context("request workload identity token")?;
        if !response.status().is_success()
            || response
                .headers()
                .get("Metadata-Flavor")
                .is_none_or(|value| value != "Google")
        {
            return Err(Error::internal(InvalidCredentials));
        }
        let mut bytes = Vec::new();
        response
            .take(16 * 1024 + 1)
            .read_to_end(&mut bytes)
            .context("read workload identity token")?;
        if bytes.len() > 16 * 1024 {
            return Err(Error::internal(InvalidCredentials));
        }
        let token: Token =
            serde_json::from_slice(&bytes).context("decode workload identity response")?;
        if token.access_token.is_empty() || token.token_type != "Bearer" || token.expires_in == 0 {
            return Err(Error::internal(InvalidCredentials));
        }
        Ok(token.access_token)
    }
}
