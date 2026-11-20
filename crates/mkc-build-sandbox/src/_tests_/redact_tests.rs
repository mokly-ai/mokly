//! Every token split point and adjacent or overlapping token forms.

use crate::redact::Redactor;

#[test]
fn redacts_both_tokens_at_every_event_boundary_and_the_end() {
    let tokens = [
        "ghs_installation0123456789",
        "mkb_uploadSecret01234567890123456789",
    ];
    let raw = format!("first {} middle {} {}", tokens[0], tokens[1], tokens[0]);
    let expected = b"first [redacted] middle [redacted] [redacted]";
    for split in 0..=raw.len() {
        let mut redactor = Redactor::new(tokens);
        let mut bytes = redactor.push(&raw.as_bytes()[..split], false);
        bytes.extend(redactor.push(&raw.as_bytes()[split..], false));
        bytes.extend(redactor.push(&[], true));
        assert_eq!(bytes, expected, "split {split}");
    }
    let mut redactor = Redactor::new(tokens);
    let mut bytes = Vec::new();
    for byte in raw.bytes() {
        bytes.extend(redactor.push(&[byte], false));
    }
    bytes.extend(redactor.push(&[], true));
    assert_eq!(bytes, expected);
}

#[test]
fn longest_token_wins_when_values_share_a_prefix() {
    let mut redactor = Redactor::new(["secret", "secret-long"]);
    let mut bytes = redactor.push(b"secret-longsecret", false);
    bytes.extend(redactor.push(&[], true));
    assert_eq!(bytes, b"[redacted][redacted]");
}

#[test]
fn short_streams_and_non_utf8_bytes_are_retained_until_final_flush() {
    let mut redactor = Redactor::new(["installation-token", "upload-token"]);
    assert!(redactor.push(b"\xffhello", false).is_empty());
    assert_eq!(redactor.push(&[], true), b"\xffhello");
}
