//! A queued signal is drained before errors from any pre-installation phase are classified.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoaderMock;
use mokly_catalogue::error::CatalogueError;
use unimock::{MockFn, Unimock, matching};

use crate::build::{BuildError, BuildService, CatalogueBuild};
use crate::cancellation::CancellationMock;
use crate::grammar::{Build, Common};
use crate::pre_installation::{cancelled, settle};

#[test]
fn build_preparation_retains_the_failure_when_a_signal_arrives_before_join() {
    let cancellation = Arc::new(Unimock::new((
        CancellationMock::requested
            .next_call(matching!())
            .returns(false),
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    )));
    let build = CatalogueBuild {
        changes: Arc::new(Unimock::new(())),
        inputs: None,
        cancellation,
        config: Arc::new(Unimock::new(
            ConfigLoaderMock::load
                .next_call(matching!(_, _))
                .returns(Err(CatalogueError::ConfigMissing {
                    searched: vec!["/repo/broken".into()],
                })),
        )),
        catalogue: Arc::new(Unimock::new(())),
        graphs: Arc::new(Unimock::new(())),
    };
    let options = Build {
        common: Common::default(),
        out: None,
        strict: false,
        no_changes: true,
    };
    let result = build.prepare(Path::new("/repo"), &options);
    assert!(matches!(result, Err(BuildError::Interrupted { source })
        if matches!(*source, BuildError::Catalogue { source: CatalogueError::ConfigMissing { .. } })));
}

#[test]
fn the_window_drains_before_testing_a_delivered_signal() {
    let signals = Unimock::new((
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    ));
    let result = settle::<()>(Err(BuildError::Viewer), &signals).unwrap_err();
    assert!(cancelled(&result));
    assert!(
        matches!(result, BuildError::Interrupted { source } if matches!(*source, BuildError::Viewer))
    );
}
#[test]
fn an_explicit_git_abort_is_cancelled_even_before_the_listener_runs() {
    let signals = Unimock::new((
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(false),
    ));
    let result = settle::<()>(
        Err(BuildError::Git {
            base: "main".into(),
            source: mokly_git::error::Error::Cancelled,
        }),
        &signals,
    )
    .unwrap_err();
    assert!(matches!(result, BuildError::Cancelled));
}

#[test]
fn configuration_git_render_and_staging_failures_share_the_same_window() {
    let errors = [
        BuildError::Catalogue {
            source: mokly_catalogue::error::CatalogueError::ConfigMissing {
                searched: vec!["/repo".into()],
            },
        },
        BuildError::Git {
            base: "main".into(),
            source: mokly_git::error::Error::NoMergeBase,
        },
        BuildError::Viewer,
        BuildError::Static {
            source: mokly_static::error::Error::Invalid {
                path: "stage".into(),
            },
        },
    ];
    for error in errors {
        let signals = Unimock::new((
            CancellationMock::drain.next_call(matching!()).returns(()),
            CancellationMock::requested
                .next_call(matching!())
                .returns(true),
        ));
        let result = settle::<()>(Err(error), &signals).unwrap_err();
        let style = crate::output::Style {
            mode: crate::output::Mode::Plain,
            color: false,
            ascii: true,
            columns: 80,
        };
        assert_eq!(
            crate::build_output::failure(&style, &result, &crate::redaction::Redactor::default()),
            "[mokly/build-invalid] build cancelled\n"
        );
        assert!(matches!(
            crate::publication::mapping::build_result::<()>(Err(result)),
            Err(crate::publication::error::Error::Build { failure })
                if failure.native().is_some_and(cancelled)
        ));
    }
}

#[test]
fn a_delivered_signal_keeps_git_cancellation_but_prints_only_cancellation() {
    let signals = Unimock::new((
        CancellationMock::drain.next_call(matching!()).returns(()),
        CancellationMock::requested
            .next_call(matching!())
            .returns(true),
    ));
    let result = settle::<()>(
        Err(BuildError::Git {
            base: "origin/main".into(),
            source: mokly_git::error::Error::Cancelled,
        }),
        &signals,
    )
    .unwrap_err();
    assert!(matches!(
        &result,
        BuildError::Git {
            source: mokly_git::error::Error::Cancelled,
            ..
        }
    ));
    for mode in [crate::output::Mode::Plain, crate::output::Mode::Rich] {
        let style = crate::output::Style {
            mode,
            color: false,
            ascii: true,
            columns: 100,
        };
        let redactor = crate::redaction::Redactor::default();
        assert_eq!(
            crate::build_output::failure(&style, &result, &redactor),
            crate::build_output::failure(&style, &BuildError::Cancelled, &redactor)
        );
    }
    assert!(!result.to_string().contains('"'));
}
