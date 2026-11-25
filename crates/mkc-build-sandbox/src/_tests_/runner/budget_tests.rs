//! Absolute budgets include sandbox creation, credentials and step progress.

use std::sync::Arc;
use std::time::Duration;

use chrono::TimeDelta;
use futures_util::stream;
use mkc_build_interface::log::{BuildLogSink, BuildLogSinkMock};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunner;
use sandbox_interface::{SandboxFilesMock, SandboxLifecycleMock, SandboxProcessesMock};
use unimock::{MockFn, Unimock, matching};

use crate::clock::{BuildClock, BuildClockMock};
use crate::runner::SandboxBuildRunner;

use super::fixtures::{INSTALLATION, create, now, provider, request, sandbox};
use super::script::events;
use super::support::capabilities;

#[tokio::test]
async fn creation_credentials_and_progress_share_the_attempt_deadline() {
    let request = request();
    let expected_create = create(&request, 1020);
    let attempt = request.attempt_operation_id;
    let backend: Arc<Unimock> = Arc::new(Unimock::new((
        SandboxLifecycleMock::create_sandbox
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                assert_eq!(actual, expected_create);
                Ok(sandbox())
            })),
        SandboxFilesMock::write_file
            .next_call(matching!(_))
            .answers_arc(Arc::new(|_, actual| {
                assert_eq!(actual.root, "/home/user");
                assert_eq!(actual.path, ".mokly-git-credentials");
                assert_eq!(
                    actual.bytes,
                    format!("https://x-access-token:{INSTALLATION}@github.com\n").as_bytes()
                );
                Ok(())
            })),
        SandboxProcessesMock::stream_process
            .next_call(matching!(_))
            .answers_arc(Arc::new(|_, actual| {
                assert_eq!(actual.command, "git");
                assert_eq!(actual.args, ["init", "--quiet", "/workspace/repo"]);
                assert_eq!(actual.cwd.as_deref(), Some("/workspace"));
                assert_eq!(actual.deadline, Duration::from_secs(400));
                assert_eq!(actual.idle_timeout, Duration::from_secs(120));
                Ok(Box::pin(stream::iter(events(9, "", ""))))
            })),
        SandboxLifecycleMock::destroy_sandbox
            .next_call(matching!(_))
            .answers_arc(Arc::new(|_, actual| {
                assert_eq!(actual, provider());
                Ok(())
            })),
    )));
    let clock: Arc<dyn BuildClock> = Arc::new(Unimock::new((
        BuildClockMock::now.next_call(matching!()).returns(now()),
        BuildClockMock::now
            .next_call(matching!())
            .returns(now() + TimeDelta::seconds(300)),
        BuildClockMock::now
            .next_call(matching!())
            .returns(now() + TimeDelta::seconds(450)),
        BuildClockMock::now
            .next_call(matching!())
            .returns(now() + TimeDelta::seconds(500)),
    )));
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new((
        BuildLogSinkMock::step_started
            .next_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, actual, step| {
                assert_eq!(actual, attempt);
                assert_eq!(step, BuildStep::Checkout);
                Ok(())
            })),
        BuildLogSinkMock::write
            .each_call(matching!(_))
            .answers_arc(Arc::new(|_, _| Ok(()))),
    )));
    let runner: &dyn BuildRunner =
        &SandboxBuildRunner::new(capabilities(backend), clock, "test-builds".into()).unwrap();
    assert!(matches!(
        runner.run(request, sink).await,
        BuildOutcome::StepFailed {
            step: BuildStep::Checkout,
            exit_code: Some(9),
            cli_error: None
        }
    ));
}
