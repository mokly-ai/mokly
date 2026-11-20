//! Signature grammar, timestamp tolerance, and independent HMAC vectors.

use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, KeyInit, Mac};
use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::webhooks::{Verification, WebhookVerifier};
use sha2::Sha256;

use crate::security::StripeSignatureVerifier;

const SECRET: &str = "whsec_fixture";

fn now() -> DateTime<Utc> {
    "2026-09-21T12:00:00Z".parse().unwrap()
}

fn signature(timestamp: i64, body: &[u8]) -> String {
    let payload = [timestamp.to_string().as_bytes(), b".", body].concat();
    let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).unwrap();
    mac.update(&payload);
    mac.finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn verifier() -> StripeSignatureVerifier {
    StripeSignatureVerifier {
        secret: Secret::new(SECRET.to_owned()),
    }
}

#[test]
fn valid_signature_and_one_of_two_v1_values_are_accepted() {
    let body = br#"{"id":"evt_fixture"}"#;
    let timestamp = now().timestamp();
    let valid = signature(timestamp, body);
    assert_eq!(
        verifier()
            .verify(&format!("t={timestamp},v1={valid}"), body, now())
            .unwrap(),
        Verification::Valid
    );
    assert_eq!(
        verifier()
            .verify(
                &format!(
                    "t={timestamp},v0=ignored,v1={},v1={}",
                    "0".repeat(64),
                    valid.to_uppercase()
                ),
                body,
                now(),
            )
            .unwrap(),
        Verification::Valid
    );
}

#[test]
fn missing_or_malformed_signature_fields_are_distinct_from_mismatch() {
    let timestamp = now().timestamp();
    for header in [
        format!("t={timestamp},v0={}", "0".repeat(64)),
        format!("t={timestamp},v1={}", "g".repeat(64)),
        format!("v1={}", "0".repeat(64)),
        format!("t=not-a-number,v1={}", "0".repeat(64)),
        format!("t={timestamp},broken"),
        format!("t={timestamp},t={timestamp},v1={}", "0".repeat(64)),
    ] {
        assert_eq!(
            verifier().verify(&header, b"body", now()).unwrap(),
            Verification::Malformed,
            "{header}"
        );
    }
    assert_eq!(
        verifier()
            .verify(
                &format!("t={timestamp},v1={}", "0".repeat(64)),
                b"body",
                now(),
            )
            .unwrap(),
        Verification::Mismatch
    );
}

#[test]
fn timestamp_is_stale_more_than_five_minutes_in_either_direction() {
    for signed_at in [
        now() - Duration::seconds(301),
        now() + Duration::seconds(301),
    ] {
        let timestamp = signed_at.timestamp();
        assert_eq!(
            verifier()
                .verify(
                    &format!("t={timestamp},v1={}", signature(timestamp, b"body")),
                    b"body",
                    now(),
                )
                .unwrap(),
            Verification::Stale
        );
    }
}

#[test]
fn empty_body_is_signed_as_timestamp_and_dot() {
    let timestamp = now().timestamp();
    assert_eq!(
        verifier()
            .verify(
                &format!("t={timestamp},v1={}", signature(timestamp, b"")),
                b"",
                now(),
            )
            .unwrap(),
        Verification::Valid
    );
}
