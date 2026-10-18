//! Serve failures retain public categories without internal prefixes or unrelated hints.

use std::io;

use mokly_server::error::{InternalError, ServerError};

use crate::output::{Mode, Style};
use crate::redaction::Redactor;
use crate::serve_errors::{changes_reason, failure};

#[test]
fn server_diagnostics_have_typed_recovery_copy() {
    let errors = [
        ServerError::Bind {
            port: 4173,
            source: io::Error::new(io::ErrorKind::AddrInUse, "address in use"),
        },
        ServerError::InvalidAssets,
        ServerError::Deadline,
        ServerError::PreviewResource,
        ServerError::Internal(InternalError::Io {
            source: io::Error::new(io::ErrorKind::PermissionDenied, "permission denied"),
        }),
    ];
    let mut output = Vec::new();
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: false,
            columns: 100,
        };
        for error in &errors {
            let text = failure(&style, error, &Redactor::default());
            assert!(!text.contains("[mokly-server/"));
            if matches!(error, ServerError::InvalidAssets) {
                assert!(!text.contains("port or process"));
            }
            output.push(text);
        }
    }
    insta::assert_snapshot!("serve_diagnostics", output.join("\n"));
}

#[test]
fn oversized_comparison_metadata_does_not_offer_retry() {
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: true,
        columns: 100,
    };
    let text = failure(
        &style,
        &ServerError::ComparisonMetadataTooLarge,
        &Redactor::default(),
    );
    assert_eq!(
        text,
        "[mokly/build-invalid] Comparison data exceeds the 64 MiB limit.\n"
    );
    assert_eq!(
        changes_reason(&ServerError::ComparisonMetadataTooLarge),
        "Comparison data exceeds the 64 MiB limit."
    );
}
