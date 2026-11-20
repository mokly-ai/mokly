//! Independent cryptographic vectors and App JWT claim verification.

use std::sync::Arc;

use jsonwebtoken::{Algorithm, DecodingKey, Validation};
use mkc_github_interface::credentials::{ClockMock, Secret};
use mkc_github_interface::webhooks::WebhookVerifier;
use serde::Deserialize;
use unimock::{MockFn, Unimock, matching};

use crate::security::{HmacVerifier, pkce_challenge};
use crate::signing::{RsaSignerFactory, SignerFactory};

use super::fixtures::now;

#[test]
fn webhook_hmac_matches_rfc_4231_and_rejects_changed_bytes() {
    let verifier: &dyn WebhookVerifier = &HmacVerifier {
        secret: Secret::new("\u{b}".repeat(20)),
    };
    let signature = "sha256=b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";
    assert!(verifier.verify(signature, b"Hi There").unwrap());
    assert!(!verifier.verify(signature, b"Hi There ").unwrap());
    for invalid in [
        "",
        "sha1=bad",
        "sha256=xyz",
        "sha256=0000000000000000000000000000000000000000000000000000000000000000",
    ] {
        assert!(!verifier.verify(invalid, b"Hi There").unwrap());
    }
}

#[test]
fn pkce_matches_the_rfc_7636_s256_vector() {
    assert_eq!(
        pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
}

#[derive(Deserialize)]
struct Claims {
    iat: i64,
    exp: i64,
    iss: String,
}

#[test]
fn app_jwt_has_a_valid_rsa_signature_and_bounded_clock_skew() {
    let clock = Arc::new(Unimock::new(
        ClockMock::now.some_call(matching!()).returns(now()),
    ));
    let jwt = RsaSignerFactory
        .build(
            "Iv1.fixture".into(),
            include_str!("../../fixtures/test-key.pem"),
            clock,
        )
        .unwrap();
    let secret = jwt.issue().unwrap();
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = false;
    let key =
        DecodingKey::from_rsa_pem(include_bytes!("../../fixtures/test-public-key.pem")).unwrap();
    let decoded = jsonwebtoken::decode::<Claims>(secret.expose(), &key, &validation).unwrap();
    assert_eq!(decoded.header.alg, Algorithm::RS256);
    assert_eq!(decoded.claims.iss, "Iv1.fixture");
    assert_eq!(decoded.claims.iat, now().timestamp() - 60);
    assert_eq!(decoded.claims.exp, now().timestamp() + 540);
}

#[test]
fn invalid_key_configuration_retains_an_internal_source() {
    let result = RsaSignerFactory.build(
        "Iv1.fixture".into(),
        "not a private key",
        Arc::new(Unimock::new(())),
    );
    assert!(result.is_err());
}
