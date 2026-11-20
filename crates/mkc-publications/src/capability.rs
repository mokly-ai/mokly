//! Signed publication capabilities with constant-time MAC verification.

use std::sync::Arc;

use hmac::{Hmac, KeyInit, Mac};
use mkc_domain::ids::{PublicationId, UserId};
use sha2::Sha256;

use crate::error::{Error, ErrorResultExt, Result};

/// Authentication payload, independent of request/session cookies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Capability {
    /// Exact publication audience.
    pub publication: PublicationId,
    /// User whose current membership is rechecked on every request.
    pub user: UserId,
    /// UTC Unix deadline, inclusive for rejection.
    pub expires: i64,
}

/// Signing and verification seam; no clocks or environment reads inside it.
#[unimock::unimock(api = CapabilitiesMock)]
pub trait Capabilities: Send + Sync {
    /// Sign one bounded authorization claim.
    fn sign(&self, capability: Capability) -> Result<String>;
    /// Authenticate a claim before returning its values.
    fn verify(&self, value: &str) -> Result<Capability>;
}

/// Composition-root signer factory.
pub trait CapabilityFactory {
    /// Load exactly 256 secret bits represented as lowercase hexadecimal.
    fn create(&self, key: &str) -> Result<Arc<dyn Capabilities>>;
}

/// HMAC-SHA-256 capability implementation factory.
pub struct HmacCapabilityFactory;

struct HmacCapabilities {
    key: Vec<u8>,
}

impl CapabilityFactory for HmacCapabilityFactory {
    fn create(&self, key: &str) -> Result<Arc<dyn Capabilities>> {
        let bytes = hex::decode(key).context("decode catalogue signing key")?;
        if bytes.len() != 32 {
            return Err(Error::Unauthorized);
        }
        Ok(Arc::new(HmacCapabilities { key: bytes }))
    }
}

impl Capabilities for HmacCapabilities {
    fn sign(&self, capability: Capability) -> Result<String> {
        let payload = format!(
            "v1.{}.{}.{}",
            capability.publication, capability.user, capability.expires
        );
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.key).context("initialize catalogue signature")?;
        mac.update(payload.as_bytes());
        Ok(format!(
            "{payload}.{}",
            hex::encode(mac.finalize().into_bytes())
        ))
    }

    fn verify(&self, value: &str) -> Result<Capability> {
        if value.len() > 256 {
            return Err(Error::Unauthorized);
        }
        let (payload, signature) = value.rsplit_once('.').ok_or(Error::Unauthorized)?;
        let signature = match hex::decode(signature) {
            Ok(bytes) => bytes,
            Err(_) => return Err(Error::Unauthorized),
        };
        let mut mac =
            Hmac::<Sha256>::new_from_slice(&self.key).context("initialize catalogue verifier")?;
        mac.update(payload.as_bytes());
        if mac.verify_slice(&signature).is_err() {
            return Err(Error::Unauthorized);
        }
        let parts: Vec<_> = payload.split('.').collect();
        if parts.len() != 4 || parts[0] != "v1" {
            return Err(Error::Unauthorized);
        }
        let publication = parts[1].parse().ok().ok_or(Error::Unauthorized)?;
        let user = parts[2].parse().ok().ok_or(Error::Unauthorized)?;
        let expires = parts[3].parse().ok().ok_or(Error::Unauthorized)?;
        Ok(Capability {
            publication: PublicationId(publication),
            user: UserId(user),
            expires,
        })
    }
}
