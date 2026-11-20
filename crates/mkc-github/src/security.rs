//! Constant-time webhook authentication and pure PKCE challenge encoding.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use mkc_github_interface::credentials::Secret;
use mkc_github_interface::error::{ErrorResultExt, Result};
use mkc_github_interface::webhooks::WebhookVerifier;
use sha2::{Digest, Sha256};

/// HMAC adapter whose credential is supplied only at composition time.
pub struct HmacVerifier {
    /// Independent GitHub webhook secret.
    pub secret: Secret,
}

impl WebhookVerifier for HmacVerifier {
    fn verify(&self, signature: &str, body: &[u8]) -> Result<bool> {
        let Some(hex) = signature.strip_prefix("sha256=") else {
            return Ok(false);
        };
        if hex.len() != 64 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Ok(false);
        }
        let mut bytes = [0_u8; 32];
        for (index, target) in bytes.iter_mut().enumerate() {
            *target = match u8::from_str_radix(&hex[index * 2..index * 2 + 2], 16) {
                Ok(byte) => byte,
                Err(_) => return Ok(false),
            };
        }
        let mut mac = Hmac::<Sha256>::new_from_slice(self.secret.expose().as_bytes())
            .context("initialize GitHub webhook MAC")?;
        mac.update(body);
        Ok(mac.verify_slice(&bytes).is_ok())
    }
}

/// RFC 7636 S256 challenge, without padding or the raw verifier.
pub fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}
