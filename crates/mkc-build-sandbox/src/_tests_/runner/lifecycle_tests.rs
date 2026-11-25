//! Ambiguous creation, boundary failures and cancellation cleanup.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use futures_util::{poll, stream};
use mkc_build_interface::error::Error;
use mkc_build_interface::log::{BuildLogSink, BuildLogSinkMock};
use mkc_build_interface::outcome::{BuildBudget, BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunner;
use sandbox_interface::{Error as SandboxError, SandboxFilesMock, SandboxLifecycleMock};
use tokio::runtime::Handle;
use tokio::task::yield_now;
use tracing::instrument::WithSubscriber;
use unimock::{MockFn, Unimock, matching};

use crate::cleanup::Cleanup;
use crate::clock::{BuildClock, BuildClockMock};
use crate::command::REPO;
use crate::runner::SandboxBuildRunner;

use super::fixtures::{INSTALLATION, UPLOAD, create, now, provider, request, sandbox};
use super::logging::Warnings;
use super::script::{Call, checkout, complete, locks};
use super::support::{Harness, capabilities};

fn clock() -> Arc<dyn BuildClock> {
    Arc::new(Unimock::new(
        BuildClockMock::now.each_call(matching!()).returns(now()),
    ))
}
fn sink() -> Arc<dyn BuildLogSink> {
    Arc::new(Unimock::new(()))
}

#[tokio::test]
async fn unavailable_create_recovers_the_same_request_without_a_second_create() {
    for (recovered, failed_recovery) in [(false, false), (true, false), (false, true)] {
        let request = request();
        let expected = create(&request, 1020);
        let recovery = expected.clone();
        let destroyed = Arc::new(AtomicUsize::new(0));
        let count = destroyed.clone();
        let common = (
            SandboxLifecycleMock::create_sandbox
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, actual| {
                    assert_eq!(actual, expected);
                    Err(SandboxError::BackendUnavailable {
                        backend_id: "e2b".into(),
                    })
                })),
            SandboxLifecycleMock::recover_sandbox_create
                .next_call(matching!(_))
                .answers_arc(Arc::new(move |_, actual| {
                    assert_eq!(actual, recovery);
                    if failed_recovery {
                        Err(SandboxError::internal_message(INSTALLATION))
                    } else {
                        Ok(recovered.then(sandbox))
                    }
                })),
        );
        let backend: Arc<Unimock> = if recovered {
            Arc::new(Unimock::new((
                common,
                SandboxFilesMock::write_file
                    .next_call(matching!(_))
                    .returns(Err(SandboxError::internal_message(INSTALLATION))),
                SandboxLifecycleMock::destroy_sandbox
                    .next_call(matching!(_))
                    .answers_arc(Arc::new(move |_, actual| {
                        assert_eq!(actual, provider());
                        count.fetch_add(1, Ordering::SeqCst);
                        Ok(())
                    })),
            )))
        } else {
            Arc::new(Unimock::new(common))
        };
        let runner: &dyn BuildRunner =
            &SandboxBuildRunner::new(capabilities(backend), clock(), "test-builds".into()).unwrap();
        let outcome = runner.run(request, sink()).await;
        assert!(matches!(outcome, BuildOutcome::Infrastructure(_)));
        assert!(!format!("{outcome:?}").contains(INSTALLATION));
        assert_eq!(destroyed.load(Ordering::SeqCst), usize::from(recovered));
    }
}

#[tokio::test]
async fn definitive_create_failure_does_not_recover_or_write() {
    let backend: Arc<Unimock> = Arc::new(Unimock::new(
        SandboxLifecycleMock::create_sandbox
            .next_call(matching!(_))
            .returns(Err(SandboxError::internal_message(UPLOAD))),
    ));
    let runner: &dyn BuildRunner =
        &SandboxBuildRunner::new(capabilities(backend), clock(), "test-builds".into()).unwrap();
    let outcome = runner.run(request(), sink()).await;
    assert!(matches!(outcome, BuildOutcome::Infrastructure(_)));
    assert!(!format!("{outcome:?}").contains(UPLOAD));
}

#[tokio::test]
async fn destroy_failure_keeps_a_completed_outcome() {
    let harness = Harness::with_destroy_failure(request(), complete());
    let warnings = Warnings::default();
    let outcome = harness.run().with_subscriber(warnings.clone()).await;
    assert!(matches!(outcome, BuildOutcome::Completed));
    warnings.assert_cleanup_failure(&harness.request);
}

#[tokio::test]
async fn destroy_failure_keeps_the_failed_install_outcome() {
    let mut calls = checkout();
    calls.extend([
        locks().output("package-lock.json\0"),
        Call::new(
            BuildStep::Install,
            "npm",
            &["ci", "--no-audit", "--no-fund"],
            REPO,
        )
        .exit(1),
    ]);
    let harness = Harness::with_destroy_failure(request(), calls);
    let warnings = Warnings::default();
    assert!(matches!(
        harness.run().with_subscriber(warnings.clone()).await,
        BuildOutcome::StepFailed {
            step: BuildStep::Install,
            exit_code: Some(1),
            cli_error: None,
        }
    ));
    warnings.assert_cleanup_failure(&harness.request);
}

#[tokio::test]
async fn an_already_expired_attempt_allocates_no_sandbox() {
    let backend: Arc<Unimock> = Arc::new(Unimock::new(()));
    let runner: &dyn BuildRunner =
        &SandboxBuildRunner::new(capabilities(backend), clock(), "test-builds".into()).unwrap();
    let mut request = request();
    request.deadline_at = now();
    assert!(matches!(
        runner.run(request, sink()).await,
        BuildOutcome::TimedOut {
            budget: BuildBudget::Deadline,
            ..
        }
    ));
}

#[tokio::test]
async fn sink_write_failure_destroys_the_sandbox_and_does_not_echo_its_error() {
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new((
        BuildLogSinkMock::step_started
            .each_call(matching!(_, _))
            .answers_arc(Arc::new(|_, _, _| Ok(()))),
        BuildLogSinkMock::write
            .next_call(matching!(_))
            .returns(Err(Error::internal_message(UPLOAD))),
    )));
    let harness = Harness::with_sink(request(), vec![checkout().remove(0).exit(1)], Some(sink));
    assert!(matches!(
        harness.run().await,
        BuildOutcome::Infrastructure(_)
    ));
}

#[tokio::test]
async fn sink_step_failure_destroys_the_sandbox_before_any_process() {
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new(
        BuildLogSinkMock::step_started
            .next_call(matching!(_, _))
            .returns(Err(Error::internal_message(INSTALLATION))),
    ));
    let harness = Harness::with_sink(request(), vec![], Some(sink));
    assert!(matches!(
        harness.run().await,
        BuildOutcome::Infrastructure(_)
    ));
}

#[tokio::test]
async fn dropping_the_run_drops_the_stream_and_destroys_its_sandbox() {
    let mut call = checkout().remove(0);
    call.stream = Some(Box::pin(stream::pending()));
    let sink: Arc<dyn BuildLogSink> = Arc::new(Unimock::new(
        BuildLogSinkMock::step_started
            .next_call(matching!(_, _))
            .returns(Ok(())),
    ));
    let harness = Harness::with_sink(request(), vec![call], Some(sink));
    let runner: &dyn BuildRunner = &SandboxBuildRunner::new(
        capabilities(harness.backend.clone()),
        harness.clock.clone(),
        "test-builds".into(),
    )
    .unwrap();
    {
        let mut future = Box::pin(runner.run(harness.request.clone(), harness.sink.clone()));
        assert!(poll!(future.as_mut()).is_pending());
    }
    yield_now().await;
    assert_eq!(harness.destroys.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn dropping_during_an_ambiguous_create_recovers_then_destroys() {
    let original = create(&request(), 1020);
    let expected = original.clone();
    let destroyed = Arc::new(AtomicUsize::new(0));
    let count = destroyed.clone();
    let backend: Arc<Unimock> = Arc::new(Unimock::new((
        SandboxLifecycleMock::recover_sandbox_create
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                assert_eq!(actual, expected);
                Ok(Some(sandbox()))
            })),
        SandboxLifecycleMock::destroy_sandbox
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, actual| {
                assert_eq!(actual, provider());
                count.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })),
    )));
    {
        let _guard = Cleanup::new(backend, Handle::current(), original);
    }
    yield_now().await;
    assert_eq!(destroyed.load(Ordering::SeqCst), 1);
}
