//! Clock, entropy and identity generation isolated from authentication policy.

use chrono::{DateTime, Utc};
use mkc_store_interface::error::{ErrorResultExt, Result};
use sha2::{Digest, Sha256};
use uuid::Uuid;

/// Generate identities and secrets before transactional work begins.
/// Build ownership clock guards read `now` after locks on each attempt.
#[unimock::unimock(api = RuntimeMock)]
pub trait Runtime: Send + Sync {
    /// Current UTC time.
    fn now(&self) -> DateTime<Utc>;
    /// A new time-ordered entity identifier.
    fn id(&self) -> Uuid;
    /// A 256-bit random hex credential.
    fn secret(&self) -> Result<String>;
}

/// Operating-system clock and cryptographically secure entropy.
pub struct SystemRuntime;

impl Runtime for SystemRuntime {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }

    fn id(&self) -> Uuid {
        Uuid::now_v7()
    }

    fn secret(&self) -> Result<String> {
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes).context("generate credential")?;
        Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
    }
}

/// One-way hash for high-entropy credentials; never password hashing.
pub fn hash(secret: &str) -> String {
    Sha256::digest(secret.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
