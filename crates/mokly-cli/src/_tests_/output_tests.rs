//! Reporter precedence, redaction, glyph and width behaviour.

use crate::codes::Code;
use crate::errors::Failure;
use crate::output::{Mode, Style, bounded, select};
use crate::redaction::Redactor;

#[test]
fn reporter_selection_follows_the_protocol_precedence() {
    assert_eq!(select(true, Some("rich"), None, true), Mode::Plain);
    assert_eq!(select(false, Some("plain"), None, true), Mode::Plain);
    assert_eq!(select(false, Some("rich"), Some("1"), false), Mode::Rich);
    assert_eq!(select(false, None, Some("1"), true), Mode::Plain);
    assert_eq!(select(false, Some("unknown"), Some(""), true), Mode::Rich);
    assert_eq!(select(false, None, None, false), Mode::Plain);
}

#[test]
fn failures_are_plain_or_rich_with_redaction_before_width_bounds() {
    let redactor = Redactor::collect(
        &["mokly".into(), "--token=a/b==".into()],
        Some("env-secret"),
    );
    let style = Style {
        mode: Mode::Plain,
        color: true,
        ascii: false,
        columns: 10,
    };
    assert_eq!(
        style.error(
            Code::CliInvalid,
            "a/b== a%2Fb%3D%3D env-secret\n\x1b",
            &redactor
        ),
        "[mokly/cli-invalid] [redacted] [redacted] [redacted]\\u000a\\u001b\n"
    );
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 100,
    };
    insta::assert_snapshot!(style.error(
        Code::BuildInvalid,
        "specs/home.screen.html:2:1 unknown element",
        &redactor
    ));
    assert!(
        style
            .failure(
                &Failure::UnknownCommand {
                    candidate: "bulid".into()
                },
                &redactor
            )
            .contains("Run `mokly build`.")
    );
    assert!(
        style
            .failure(
                &Failure::UnknownOption {
                    option: "--watc".into()
                },
                &redactor
            )
            .contains("Unknown option \"--watc\".")
    );
    let style = Style {
        ascii: true,
        ..style
    };
    assert!(
        style
            .error(Code::CliInvalid, "bad argument", &redactor)
            .starts_with("x ")
    );
}

#[test]
fn truncation_preserves_complete_sequences_and_unicode_columns() {
    assert_eq!(bounded("abcdef", 4), "abc…");
    assert_eq!(bounded("界界界", 5), "界界…");
    assert_eq!(bounded("\x1b[31mabcdef\x1b[0m", 4), "\x1b[31mabc…\x1b[0m");
    assert_eq!(bounded("abc\x1b[31", 80), "abc");
    assert_eq!(bounded("abcdef", 1), "…");
    assert_eq!(bounded("abc", 0), "abc");
}

#[test]
fn upload_cancellation_and_transport_have_distinct_recovery_copy() {
    let redactor = Redactor::default();
    let plain = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    };
    assert_eq!(
        plain.error(Code::UploadCancelled, "ignored provider text", &redactor),
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n"
    );
    assert_eq!(
        plain.error(Code::UploadTransport, "ignored provider text", &redactor),
        "[mokly/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry.\n"
    );
    let rich = Style {
        mode: Mode::Rich,
        columns: 100,
        ..plain
    };
    let cancellation = rich.error(Code::UploadCancelled, "ignored provider text", &redactor);
    assert_eq!(cancellation.lines().count(), 2);
    assert!(!cancellation.contains("connection"));
    let transport = rich.error(Code::UploadTransport, "ignored provider text", &redactor);
    assert_eq!(transport.lines().count(), 2);
    assert!(!transport.contains("cancelled"));
}

#[test]
fn short_secrets_never_change_codes_or_fixed_error_copy() {
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 80,
    };
    for secret in ["-", "i", "option"] {
        let redactor = Redactor::collect(&[], Some(secret));
        let failure = Failure::UnknownOption {
            option: "--invalid".into(),
        };
        let output = style.failure(&failure, &redactor);
        assert!(output.starts_with("[mokly/cli-invalid] unknown option: "));
        let output = style.failure(&Failure::Unavailable { command: "publish" }, &redactor);
        assert!(output.starts_with("[mokly/build-invalid] "));
    }
}
