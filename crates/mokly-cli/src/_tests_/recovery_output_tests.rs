//! Recovery details keep complete, distinct paths under the normal terminal width.

use std::path::PathBuf;

use mokly_static::error::Error;

use crate::build::BuildError;
use crate::build_output::failure;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;

use super::path;

fn root() -> PathBuf {
    PathBuf::from(if cfg!(windows) { "C:\\repo" } else { "/repo" })
}

#[test]
fn nested_recovery_keeps_each_full_path_once_after_both_causes() {
    let cwd = root();
    let reservation = cwd.join("long-reservation-".repeat(8));
    let backup = reservation.join("backup");
    let error = BuildError::Cleanup {
        primary: Box::new(BuildError::Static {
            source: Error::Recovery {
                primary: Box::new(Error::Cancelled),
                cleanup: Box::new(Error::Unexpected {
                    path: backup.clone(),
                }),
                path: backup.clone(),
            },
        }),
        cleanup: Box::new(Error::Reserved {
            path: reservation.clone(),
        }),
        path: reservation.clone(),
    };
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: true,
            columns: 80,
        };
        let redactor = Redactor::default();
        let text = failure(&style, &error, &redactor, &cwd);
        assert!(!text.contains("Inspect retained recovery path"));
        let lines: Vec<_> = text
            .lines()
            .filter(|line| line.starts_with("  Recovery path:"))
            .collect();
        assert_eq!(
            lines,
            [
                format!(
                    "  Recovery path: {}",
                    backup.strip_prefix(&cwd).unwrap().display()
                ),
                format!(
                    "  Recovery path: {}",
                    reservation.strip_prefix(&cwd).unwrap().display()
                ),
            ]
        );
        assert!(
            lines
                .iter()
                .all(|line| line.len() > 80 && !line.contains('…'))
        );
        assert!(text.find("build cancelled").unwrap() < text.find("Recovery failed").unwrap());
        assert!(text.find("Recovery failed").unwrap() < text.find("Recovery path:").unwrap());
    }
}

#[test]
fn path_display_keeps_outside_paths_absolute_and_escapes_before_printing() {
    let cwd = root();
    let inside = cwd.join("site");
    let outside = cwd.with_file_name("repo-other").join("site");
    let redactor = Redactor::collect(&[], Some("secret"));
    assert_eq!(path(&inside, &cwd, &redactor), "site");
    assert_eq!(path(&cwd, &cwd, &redactor), ".");
    assert_eq!(path(&outside, &cwd, &redactor), outside.to_string_lossy());
    assert_eq!(
        path(&cwd.join("secret\nname"), &cwd, &redactor),
        "[redacted]\\u000aname"
    );
}
