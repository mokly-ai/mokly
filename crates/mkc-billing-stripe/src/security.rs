//! Stripe signature parsing, freshness checks, and constant-time verification.

use chrono::{DateTime, Utc};
use hmac::{Hmac, KeyInit, Mac};
use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::error::{ErrorResultExt, Result};
use mkc_billing_interface::webhooks::{Verification, WebhookVerifier};
use sha2::Sha256;

const TOLERANCE_SECONDS: u64 = 300;

/// Stripe webhook verifier configured with an endpoint signing secret.
pub struct StripeSignatureVerifier {
    /// Independent webhook signing secret.
    pub secret: Secret,
}

impl WebhookVerifier for StripeSignatureVerifier {
    fn verify(
        &self,
        signature_header: &str,
        body: &[u8],
        now: DateTime<Utc>,
    ) -> Result<Verification> {
        let mut timestamp = None;
        let mut signatures = Vec::new();
        for field in signature_header.split(',') {
            let Some((key, value)) = field.trim().split_once('=') else {
                return Ok(Verification::Malformed);
            };
            if key.is_empty() || value.is_empty() {
                return Ok(Verification::Malformed);
            }
            match key {
                "t" if timestamp.is_none() => timestamp = Some(value),
                "t" => return Ok(Verification::Malformed),
                "v1" => match decode_signature(value) {
                    Some(signature) => signatures.push(signature),
                    None => return Ok(Verification::Malformed),
                },
                _ => {}
            }
        }
        let Some(timestamp_text) = timestamp else {
            return Ok(Verification::Malformed);
        };
        let Ok(timestamp) = timestamp_text.parse::<i64>() else {
            return Ok(Verification::Malformed);
        };
        if signatures.is_empty() {
            return Ok(Verification::Malformed);
        }
        if now.timestamp().abs_diff(timestamp) > TOLERANCE_SECONDS {
            return Ok(Verification::Stale);
        }
        let mut payload = Vec::with_capacity(timestamp_text.len() + 1 + body.len());
        payload.extend_from_slice(timestamp_text.as_bytes());
        payload.push(b'.');
        payload.extend_from_slice(body);
        for signature in signatures {
            let mut mac = Hmac::<Sha256>::new_from_slice(self.secret.expose().as_bytes())
                .context("initialize Stripe webhook MAC")?;
            mac.update(&payload);
            if mac.verify_slice(&signature).is_ok() {
                return Ok(Verification::Valid);
            }
        }
        Ok(Verification::Mismatch)
    }
}

fn decode_signature(value: &str) -> Option<[u8; 32]> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    let mut decoded = [0_u8; 32];
    for (index, target) in decoded.iter_mut().enumerate() {
        *target = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16).ok()?;
    }
    Some(decoded)
}
