//! Secret diagnostics expose no credential bytes.

use crate::credentials::Secret;

#[test]
fn secret_debug_is_redacted_while_explicit_exposure_is_available() {
    let secret = Secret::new("sk_fixture_secret".to_owned());
    assert_eq!(secret.expose(), "sk_fixture_secret");
    assert_eq!(format!("{secret:?}"), "Secret([redacted])");
    assert!(!format!("{secret:?}").contains(secret.expose()));
}
