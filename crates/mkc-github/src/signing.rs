//! RS256 App JWT signer with an injected UTC clock.

use std::sync::Arc;

use jsonwebtoken::{Algorithm, EncodingKey, Header};
use mkc_github_interface::credentials::{AppJwt, Clock, Secret};
use mkc_github_interface::error::{Error, ErrorResultExt, Result};
use serde::Serialize;

/// Signing factory validates private key material without exposing it.
pub trait SignerFactory {
    /// Build an App signer from PEM configuration.
    fn build(&self, client_id: String, pem: &str, clock: Arc<dyn Clock>)
    -> Result<Arc<dyn AppJwt>>;
}

/// RSA signing composition root.
pub struct RsaSignerFactory;

struct RsaSigner {
    client_id: String,
    key: EncodingKey,
    clock: Arc<dyn Clock>,
}

#[derive(Serialize)]
struct Claims<'a> {
    iat: i64,
    exp: i64,
    iss: &'a str,
}

impl SignerFactory for RsaSignerFactory {
    fn build(
        &self,
        client_id: String,
        pem: &str,
        clock: Arc<dyn Clock>,
    ) -> Result<Arc<dyn AppJwt>> {
        if client_id.is_empty() {
            return Err(Error::InvalidRequest);
        }
        let key =
            EncodingKey::from_rsa_pem(pem.as_bytes()).context("read GitHub RSA private key")?;
        Ok(Arc::new(RsaSigner {
            client_id,
            key,
            clock,
        }))
    }
}

impl AppJwt for RsaSigner {
    fn issue(&self) -> Result<Secret> {
        let now = self.clock.now().timestamp();
        let claims = Claims {
            iat: now - 60,
            exp: now + 540,
            iss: &self.client_id,
        };
        Ok(Secret::new(
            jsonwebtoken::encode(&Header::new(Algorithm::RS256), &claims, &self.key)
                .context("sign GitHub App JWT")?,
        ))
    }
}
