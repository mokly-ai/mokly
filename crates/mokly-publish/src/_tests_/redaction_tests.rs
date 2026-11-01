//! Secret matcher diagnostics never expose the matched value.

use super::{Secret, SecretMatcher};

#[test]
fn debug_does_not_expose_secret() {
    let secret = Secret::new("secret/a==");
    assert_eq!(format!("{secret:?}"), "Secret([redacted])");
    let matcher = SecretMatcher::new("secret/a==");
    assert_eq!(
        format!("{matcher:?}"),
        "SecretMatcher { secret: Secret([redacted]) }"
    );
}

#[test]
fn literal_percent_and_percent_encoded_secret_forms_match() {
    let matcher = SecretMatcher::new("ab%zz");
    assert_eq!(matcher.redact("value ab%zz end"), "value [redacted] end");
    assert_eq!(matcher.redact("value ab%25zz end"), "value [redacted] end");
    assert_eq!(matcher.redact("value ab%zy end"), "value ab%zy end");
    assert_eq!(matcher.redact("value ab%z end"), "value ab%z end");
}

#[test]
fn malformed_percent_secret_matches_literal_and_longest_escape_reading() {
    let matcher = SecretMatcher::new("abc%2Bdef");
    assert_eq!(matcher.redact("--token=abc%2Bdef"), "--token=[redacted]");
    assert_eq!(matcher.redact("--token=abc%252Bdef"), "--token=[redacted]");

    let mixed = SecretMatcher::new("a%b%41");
    assert_eq!(mixed.redact("a%25b%41"), "[redacted]");

    let trailing = SecretMatcher::new("ab%");
    assert_eq!(trailing.redact("xab%"), "x[redacted]");
    assert_eq!(trailing.redact("ab%25"), "[redacted]");
}
