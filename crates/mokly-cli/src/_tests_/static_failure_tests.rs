//! New static failure arms and combined recovery have exact plain and rich output.

use std::path::PathBuf;

use mokly_static::error::{Error, InternalError};
use mokly_static::inspector_error::InspectorFailure;

use crate::build::BuildError;
use crate::build_output::failure;
use crate::output::{Mode, Style};
use crate::redaction::Redactor;

#[test]
fn static_errors_show_safe_paths_bounded_entries_and_each_cause_once() {
    let samples = [
        BuildError::Viewer,
        BuildError::Git {
            base: "main".into(),
            source: mokly_git::error::Error::NoMergeBase,
        },
        BuildError::Interrupted {
            source: Box::new(BuildError::Viewer),
        },
        BuildError::Static {
            source: Error::Empty,
        },
        BuildError::Static {
            source: Error::Inspector {
                route: "home/index.html".into(),
                reason: InspectorFailure::Reserved {
                    attribute: "data-mokly-inspector-link",
                },
            },
        },
        BuildError::Static {
            source: Error::Ownership {
                path: PathBuf::from("C:\\site"),
            },
        },
        BuildError::Static {
            source: Error::Unowned {
                path: "/repo/site".into(),
                entries: vec!["z".into(), "a".into()],
            },
        },
        BuildError::Static {
            source: Error::UnexpectedEntries {
                path: "/repo/site".into(),
                entries: (0..23)
                    .rev()
                    .map(|index| format!("file-{index:02}"))
                    .collect(),
            },
        },
        BuildError::Static {
            source: Error::Recovery {
                primary: Box::new(Error::Cancelled),
                cleanup: Box::new(Error::Internal(InternalError::Rename {
                    source: mokly_platform::error::Error::DestinationExists {
                        path: "/repo/site".into(),
                    },
                })),
                path: "/kept/backup".into(),
            },
        },
        BuildError::Static {
            source: Error::Installed {
                source: Box::new(Error::Unexpected {
                    path: "/kept/backup/new".into(),
                }),
                path: "/kept/backup".into(),
            },
        },
        BuildError::Shutdown {
            primary: Box::new(BuildError::Cancelled),
            shutdown: Box::new(BuildError::Viewer),
        },
        BuildError::Cleanup {
            primary: Box::new(BuildError::Cancelled),
            cleanup: Box::new(Error::Unexpected {
                path: "/kept/secret".into(),
            }),
            path: "/kept/secret".into(),
        },
    ];
    let redactor = Redactor::collect(&[], Some("secret"));
    let mut outputs = Vec::new();
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: true,
            columns: 200,
        };
        for sample in &samples {
            outputs.push(failure(&style, sample, &redactor));
        }
    }
    let output = outputs.join("\n");
    assert!(!output.contains("[mokly-static"));
    assert!(!output.contains("[mokly-cli"));
    assert!(!output.contains("[mokly-platform"));
    assert!(!output.contains("secret"));
    assert!(!output.contains("file-22"));
    insta::assert_snapshot!(output);
}
