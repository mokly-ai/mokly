//! A known scrypt verifier made by Python checks the same bytes in Rust.

use crate::preview_verifier::PreviewVerifier;

use super::support::preview_fixture;

#[test]
fn shared_fixture_accepts_only_its_exact_password() {
    let (password, verifier) = preview_fixture();
    let verifier = PreviewVerifier::parse(verifier).unwrap();
    assert!(verifier.matches(password));
    assert!(!verifier.matches(&format!("{password} ")));
}
