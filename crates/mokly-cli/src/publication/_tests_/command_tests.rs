//! Clean-checkout and build boundaries must complete before any receiver request.

use std::path::PathBuf;
use std::sync::Arc;

use crate::publication::error::Error;
use mokly_publish::accounting::Receipt;
use mokly_publish::checkout::{CheckoutMock, Inspection};
use mokly_publish::completion::{Completion, Outcome};
use mokly_publish::error;
use mokly_publish::exchange::ExchangeMock;
use mokly_publish::identity::ActionsContext;
use mokly_publish::snapshot::{Finalized, OutputSnapshot, OutputSnapshotMock};
use unimock::{MockFn, Unimock, matching};

use crate::publication::build::{DirectoriesMock, StaticOutputMock, warnings_are_fatal};
use crate::publication::command::{BuildReporterMock, Command, Options, Publish};

use super::support::{artifact, publication, settings};

fn inspection() -> Inspection {
    Inspection {
        root: "/repo".into(),
        head_sha: "a".repeat(40),
        changed_paths: Vec::new(),
        build_directories: Vec::new(),
    }
}
fn options() -> Options {
    Options {
        directory: "/repo/tools".into(),
        version: publication().mokly_version,
        repository: None,
        actions: ActionsContext::default(),
        config: Some("tools/mokly.config.json".into()),
        base: None,
        no_changes: true,
        strict: false,
        owned_paths: Vec::new(),
    }
}
fn command(mock: Arc<Unimock>) -> Command {
    Command {
        checkout: mock.clone(),
        directories: mock.clone(),
        output: mock.clone(),
        reporter: mock.clone(),
        exchange: mock,
    }
}

#[tokio::test]
async fn command_reports_the_directory_once_then_builds_rechecks_and_uploads_the_snapshot() {
    let snapshot: Arc<dyn OutputSnapshot> = Arc::new(Unimock::new(
        OutputSnapshotMock::capture
            .next_call(matching!())
            .returns(Ok(Finalized::new(artifact(false)).unwrap())),
    ));
    let expected = Receipt {
        completion: Completion {
            outcome: Outcome::Published,
            viewer_url: None,
        },
        uploaded: 6,
        unchanged: 0,
    };
    let mock = Arc::new(Unimock::new((
        CheckoutMock::inspect
            .next_call(matching!(_, _, _))
            .returns(Ok(inspection())),
        CheckoutMock::publication
            .next_call(matching!(_, _, _, _, _))
            .returns(Ok(publication())),
        DirectoriesMock::create
            .next_call(matching!(_))
            .returns(Ok(PathBuf::from("/private/publish"))),
        BuildReporterMock::build_directory
            .next_call(matching!(_))
            .returns(()),
        StaticOutputMock::build
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, _| {
                assert_eq!(request.directory, PathBuf::from("/private/publish"));
                assert_eq!(request.repository_root, PathBuf::from("/repo"));
                assert_eq!(request.invocation_directory, PathBuf::from("/repo/tools"));
                assert!(request.no_changes);
                assert!(request.warnings_are_fatal);
                assert!(request.base.is_none());
                Ok(snapshot.clone())
            })),
        CheckoutMock::inspect
            .next_call(matching!(_, _, _))
            .returns(Ok(inspection())),
        ExchangeMock::publish
            .next_call(matching!(_, _, _))
            .returns(Ok(expected.clone())),
    )));
    let command: &dyn Publish = &command(mock);
    assert_eq!(
        command
            .run(&options(), &settings(8), &Unimock::new(()))
            .await
            .unwrap(),
        expected
    );
    assert!(warnings_are_fatal(false));
    assert!(warnings_are_fatal(true));
}

#[tokio::test]
async fn a_dirty_checkout_stops_before_build_or_network() {
    let mut initial = inspection();
    initial.changed_paths = vec!["source.screen.html".to_owned()];
    let mock = Arc::new(Unimock::new(
        CheckoutMock::inspect
            .next_call(matching!(_, _, _))
            .returns(Ok(initial)),
    ));
    let command: &dyn Publish = &command(mock);
    assert!(matches!(
        command
            .run(&options(), &settings(1), &Unimock::new(()))
            .await,
        Err(Error::Uncommitted {
            during_build: false,
            ..
        })
    ));
}

#[tokio::test]
async fn a_build_failure_keeps_its_own_error_and_stops_before_recheck_or_network() {
    for error in [
        Error::BuildWarnings,
        Error::Exchange {
            source: error::Error::Cancelled,
        },
        Error::Exchange {
            source: error::Error::InvalidBundle,
        },
    ] {
        let expected = std::mem::discriminant(&error);
        let mock = Arc::new(Unimock::new((
            CheckoutMock::inspect
                .next_call(matching!(_, _, _))
                .returns(Ok(inspection())),
            CheckoutMock::publication
                .next_call(matching!(_, _, _, _, _))
                .returns(Ok(publication())),
            DirectoriesMock::create
                .next_call(matching!(_))
                .returns(Ok(PathBuf::from("/private/publish"))),
            BuildReporterMock::build_directory
                .next_call(matching!(_))
                .returns(()),
            StaticOutputMock::build
                .next_call(matching!(_, _))
                .returns(Err(error)),
        )));
        let command: &dyn Publish = &command(mock);
        assert_eq!(
            std::mem::discriminant(
                &command
                    .run(&options(), &settings(1), &Unimock::new(()))
                    .await
                    .unwrap_err()
            ),
            expected
        );
    }
}

#[tokio::test]
async fn changed_head_or_new_paths_after_the_build_stop_before_plan() {
    for changed_head in [true, false] {
        let mut final_state = inspection();
        if changed_head {
            final_state.head_sha = "b".repeat(40);
        } else {
            final_state.changed_paths = vec!["new.txt".to_owned()];
        }
        let snapshot: Arc<dyn OutputSnapshot> = Arc::new(Unimock::new(
            OutputSnapshotMock::capture
                .next_call(matching!())
                .returns(Ok(Finalized::new(artifact(false)).unwrap())),
        ));
        let mock = Arc::new(Unimock::new((
            CheckoutMock::inspect
                .next_call(matching!(_, _, _))
                .returns(Ok(inspection())),
            CheckoutMock::publication
                .next_call(matching!(_, _, _, _, _))
                .returns(Ok(publication())),
            DirectoriesMock::create
                .next_call(matching!(_))
                .returns(Ok(PathBuf::from("/private/publish"))),
            BuildReporterMock::build_directory
                .next_call(matching!(_))
                .returns(()),
            StaticOutputMock::build
                .next_call(matching!(_, _))
                .returns(Ok(snapshot)),
            CheckoutMock::inspect
                .next_call(matching!(_, _, _))
                .returns(Ok(final_state)),
        )));
        let command: &dyn Publish = &command(mock);
        let error = command
            .run(&options(), &settings(1), &Unimock::new(()))
            .await
            .unwrap_err();
        assert!(if changed_head {
            matches!(error, Error::HeadChanged)
        } else {
            matches!(
                error,
                Error::Uncommitted {
                    during_build: true,
                    ..
                }
            )
        });
    }
}
