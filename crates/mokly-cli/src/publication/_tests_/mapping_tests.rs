//! Publish uses only an explicit cancellation classification and keeps recovery failures.

use std::path::Path;

use crate::build::BuildError;
use crate::output::{Mode, Style};
use crate::publication::error::Error;
use crate::publication::mapping::build_result;
use crate::publish_errors;
use crate::redaction::Redactor;

#[test]
fn warning_cancellation_and_recovery_keep_distinct_publication_variants() {
    assert!(matches!(
        build_result::<()>(Err(BuildError::Warnings)),
        Err(Error::BuildWarnings)
    ));
    assert!(matches!(
        build_result::<()>(Err(BuildError::Cancelled)),
        Err(Error::Build { failure }) if matches!(failure.native(), Some(BuildError::Cancelled))
    ));
    let failure = BuildError::Cleanup {
        primary: Box::new(BuildError::Cancelled),
        cleanup: Box::new(mokly_static::error::Error::Unexpected {
            path: "/kept".into(),
        }),
        path: "/kept".into(),
    };
    assert!(matches!(
        build_result::<()>(Err(failure)),
        Err(Error::Build { .. })
    ));
}

#[test]
fn interrupted_publications_keep_the_original_diagnostic_for_optional_stacks() {
    let error = build_result::<()>(Err(BuildError::Interrupted {
        source: Box::new(BuildError::Deferred {
            modules: vec!["specs/broken.mockup.ts export Main".into()],
            warnings: Vec::new(),
        }),
    }))
    .unwrap_err();
    assert!(
        error
            .to_string()
            .contains("specs/broken.mockup.ts export Main")
    );
    for mode in [Mode::Plain, Mode::Rich] {
        let style = Style {
            mode,
            color: false,
            ascii: true,
            columns: 120,
        };
        assert_eq!(
            publish_errors::command(&error, &style, &Redactor::default(), Path::new("/repo")),
            publish_errors::render(
                &mokly_publish::error::Error::Cancelled,
                &style,
                &Redactor::default()
            )
        );
    }
}
