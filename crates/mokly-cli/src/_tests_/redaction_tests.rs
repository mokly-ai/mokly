//! Large diagnostic chunks retain exact redaction, Unicode, and control escaping.

use super::Redactor;

#[test]
fn long_diagnostics_keep_unicode_secrets_and_control_rules() {
    let prefix = "λ😀".repeat(16_384);
    let redactor = Redactor::collect(&[], Some("private/token"));
    assert_eq!(redactor.safe(&prefix), prefix);
    let source = format!("{prefix} private/token private%2Ftoken\n\u{1b}\t");
    assert_eq!(
        redactor.safe(&source),
        format!("{prefix} [redacted] [redacted]\\u000a\\u001b\\u0009")
    );
    assert_eq!(
        redactor.safe_lines(&source),
        format!("{prefix} [redacted] [redacted]\n\\u001b\\u0009")
    );
}

#[test]
fn malformed_argument_and_environment_tokens_are_redacted() {
    let arguments = vec!["mokly".to_owned(), "--token=abc%2Bdef".to_owned()];
    let redactor = Redactor::collect(&arguments, Some("ab%zz"));
    assert_eq!(
        redactor.safe("diagnostic ab%zz and abc%2Bdef"),
        "diagnostic [redacted] and [redacted]"
    );
}
