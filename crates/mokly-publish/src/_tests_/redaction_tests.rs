//! Secret matcher diagnostics never expose the matched value.

use super::SecretMatcher;

#[test]
fn debug_does_not_expose_secret() {
    let matcher = SecretMatcher::new("secret/a==");
    assert_eq!(format!("{matcher:?}"), "SecretMatcher([redacted])");
}
