//! Publication copy, path escaping and recovery hints.

use std::path::Path;

use crate::publication::error::{self, DirectoryFailure};
use mokly_publish::error::Error;

use crate::output::{Mode, Style};
use crate::publish_errors::{render, uncommitted};
use crate::redaction::Redactor;

#[test]
fn fixed_upload_copy_and_rich_sentences_appear_once() {
    let redactor = Redactor::collect(&[], Some("secret/a=="));
    let mut style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 200,
    };
    assert_eq!(
        render(&Error::Cancelled, &style, &redactor),
        "[mokly/upload-failed] Publication was cancelled. Run mokly publish again when you are ready.\n"
    );
    assert_eq!(
        render(&Error::Transport, &style, &redactor),
        "[mokly/upload-failed] The catalogue upload did not complete. Check the endpoint and connection, then retry.\n"
    );
    style.mode = Mode::Rich;
    let error = render(&Error::InvalidBundle, &style, &redactor);
    assert_eq!(error.matches("The catalogue upload is invalid.").count(), 1);
    assert_eq!(error.matches("Rebuild the catalogue and retry.").count(), 1);
    insta::assert_snapshot!(error);
}

#[test]
fn checkout_paths_are_sorted_bounded_escaped_and_have_literal_ignore_rules() {
    let redactor = Redactor::collect(&[], Some("secret"));
    let mut paths: Vec<_> = (0..23)
        .rev()
        .map(|number| format!("file-{number:02}"))
        .collect();
    paths.extend([
        "file-00".to_owned(),
        "mokly-static/file".to_owned(),
        "a\nsecret\u{85}".to_owned(),
    ]);
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 200,
    };
    let output = uncommitted(
        &paths,
        true,
        &["mokly-static".to_owned()],
        &style,
        &redactor,
    );
    assert_eq!(output.matches("  - ").count(), 20);
    assert!(output.contains("5 other paths."));
    assert!(output.contains("a\\u000a[redacted]\\u0085"));
    assert!(!output.contains("/mokly-static/"));
    assert!(output.contains("Changes appeared during the build."));
    insta::assert_snapshot!(output);
    let rich = Style {
        mode: Mode::Rich,
        ..style
    };
    let rich_output = uncommitted(&paths, true, &["mokly-static".to_owned()], &rich, &redactor);
    assert_eq!(
        rich_output
            .matches("The checkout has uncommitted changes.")
            .count(),
        1
    );
    assert_eq!(
        rich_output
            .matches("Commit, stash or ignore these files, then publish again.")
            .count(),
        1
    );
    assert!(!rich_output.contains("/mokly-static/"));
    insta::assert_snapshot!(rich_output);
    let output = uncommitted(
        &["out[1]*?/file".to_owned()],
        false,
        &["out[1]*?".to_owned()],
        &style,
        &redactor,
    );
    assert!(output.contains("/out\\[1\\]\\*\\?/"));
}

#[derive(Debug, thiserror::Error)]
#[error("Static build recovery needs /backup/secret/a==")]
struct RecoveryFailure;

impl crate::publication::failure::BuildFailure for RecoveryFailure {
    fn category(&self) -> crate::publication::failure::Category {
        crate::publication::failure::Category::ExportInvalid
    }
    fn detail(&self) -> String {
        self.to_string()
    }
}

#[test]
fn build_recovery_errors_keep_their_category_and_redacted_recovery_path() {
    let error = error::Error::Build {
        failure: Box::new(RecoveryFailure),
    };
    let style = Style {
        mode: Mode::Plain,
        color: false,
        ascii: false,
        columns: 200,
    };
    let redactor = Redactor::collect(&[], Some("secret/a=="));
    assert_eq!(
        crate::publish_errors::command(&error, &style, &redactor, Path::new("/repo")),
        "[mokly/export-invalid] Static build recovery needs /backup/[redacted]\n"
    );
}

#[test]
fn rich_directory_errors_show_the_root_and_windows_recovery_once() {
    let error = error::Error::Directory {
        temporary_root: "missing-root".into(),
        reason: DirectoryFailure::Unavailable {
            source: std::io::Error::from(std::io::ErrorKind::NotFound),
        },
    };
    let style = Style {
        mode: Mode::Rich,
        color: false,
        ascii: false,
        columns: 200,
    };
    let rendered = crate::publish_errors::command(
        &error,
        &style,
        &Redactor::collect(&[], None),
        Path::new("/repo"),
    );
    for sentence in [
        "The publish build directory could not be prepared.",
        "Temporary root: missing-root.",
        "Set TMPDIR, or TMP on Windows, to a writable directory outside the checkout.",
    ] {
        assert_eq!(rendered.matches(sentence).count(), 1);
    }
    insta::assert_snapshot!(rendered);
}
