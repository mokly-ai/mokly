//! Bounded verification of the shared preview password.

use std::sync::{Condvar, Mutex, PoisonError};

use base64::Engine;
use base64::engine::general_purpose::STANDARD_NO_PAD;
use scrypt::{Params, scrypt};
use subtle::ConstantTimeEq;

static HASH_SLOTS: Mutex<u8> = Mutex::new(2);
static HASH_SLOT_RELEASED: Condvar = Condvar::new();

/// Validated preview verifier, intentionally without `Debug`.
#[derive(Clone)]
pub struct PreviewVerifier {
    params: Params,
    salt: [u8; 16],
    hash: [u8; 32],
}

impl PreviewVerifier {
    /// Read the scrypt PHC string and enforce the preview cost and length bounds.
    pub fn parse(value: &str) -> Option<Self> {
        let mut fields = value.strip_prefix("$scrypt$")?.split('$');
        let mut costs = fields.next()?.split(',');
        let log_n = decimal(costs.next()?.strip_prefix("ln=")?)?;
        if costs.next()? != "r=8" {
            return None;
        }
        let p = decimal(costs.next()?.strip_prefix("p=")?)?;
        if costs.next().is_some() || !(1..=16).contains(&log_n) || !(1..=8).contains(&p) {
            return None;
        }
        let salt = decode(fields.next()?)?;
        let hash = decode(fields.next()?)?;
        if fields.next().is_some() {
            return None;
        }
        Some(Self {
            params: Params::new(log_n, 8, u32::from(p)).ok()?,
            salt,
            hash,
        })
    }

    /// Check the exact UTF-8 bytes of the password on a blocking worker.
    pub fn matches(&self, password: &str) -> bool {
        let _slot = HashSlot::acquire();
        let mut derived = [0; 32];
        scrypt(password.as_bytes(), &self.salt, &self.params, &mut derived).is_ok()
            && bool::from(derived.ct_eq(&self.hash))
    }
}

fn decimal(digits: &str) -> Option<u8> {
    if digits.starts_with('0') || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    digits.parse().ok()
}

fn decode<const N: usize>(value: &str) -> Option<[u8; N]> {
    let mut bytes = [0; N];
    let length = STANDARD_NO_PAD.decode_slice(value, &mut bytes).ok()?;
    (length == N).then_some(bytes)
}

struct HashSlot;

impl HashSlot {
    fn acquire() -> Self {
        let available = HASH_SLOTS.lock().unwrap_or_else(PoisonError::into_inner);
        let mut available = HASH_SLOT_RELEASED
            .wait_while(available, |slots| *slots == 0)
            .unwrap_or_else(PoisonError::into_inner);
        *available -= 1;
        Self
    }
}

impl Drop for HashSlot {
    fn drop(&mut self) {
        *HASH_SLOTS.lock().unwrap_or_else(PoisonError::into_inner) += 1;
        HASH_SLOT_RELEASED.notify_one();
    }
}
