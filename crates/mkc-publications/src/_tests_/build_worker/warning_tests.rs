//! One safe warning for each committed infrastructure ending, and none otherwise.

use std::collections::BTreeMap;
use std::sync::Arc;

use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::{BuildRunner, BuildRunnerMock};
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_github_interface::error::Error;
use mkc_store_interface::build::{Build, BuildsMock};
use mkc_store_interface::build_grant::BuildUploadGrantsMock;
use mkc_store_interface::build_state::{self, BuildState};
use mkc_store_interface::publication::{PublicationFailure, PublicationsMock};
use tracing::instrument::WithSubscriber;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries_at, worker};
use super::warnings::{capture, warning};

#[derive(Debug, thiserror::Error)]
#[error("provider body ghs_provider_secret")]
struct ProviderBody;

struct Attempt {
    number: i32,
    published: bool,
    token: Result<&'static str, Error>,
    outcome: Option<BuildOutcome>,
    finished: bool,
}

impl Attempt {
    fn runner(number: i32, outcome: BuildOutcome) -> Self {
        Self {
            number,
            published: false,
            token: Ok("scoped"),
            outcome: Some(outcome),
            finished: true,
        }
    }

    fn token(token: Result<&'static str, Error>) -> Self {
        Self {
            number: 1,
            published: false,
            token,
            outcome: None,
            finished: true,
        }
    }
}

fn uploads_expire() -> impl unimock::Clause {
    PublicationsMock::fail_build_uploads
        .some_call(matching!(&BUILD, _, PublicationFailure::Expired, _))
        .answers(&|_, _, _, _, _| Ok(0))
}

fn attempt_queries(running: Build, number: i32, finished: bool) -> impl unimock::Clause {
    (
        eligibility(
            Some(project()),
            Some(repository()),
            Some(installation()),
            Plan::Free,
        ),
        start_queries_at(number),
        BuildsMock::build
            .some_call(matching!(_, _))
            .returns(Ok(Some(running))),
        BuildsMock::finish_build
            .some_call(matching!(_, _, _))
            .answers_arc(Arc::new(move |_, _, _, _| Ok(finished))),
    )
}

fn no_grant_outcome() -> impl unimock::Clause {
    BuildUploadGrantsMock::build_attempt_grant
        .some_call(matching!(_, _))
        .answers(&|_, _, _| Ok(None))
}

async fn execute(case: Attempt) -> Vec<BTreeMap<String, String>> {
    let mut running = build(BuildState::Running);
    running.attempt = case.number;
    if case.published {
        running.publication_id = Some(uuid::Uuid::from_u128(7).into());
    }
    let base = attempt_queries(running, case.number, case.finished);
    let queries = match (case.outcome.is_some() && !case.published, case.finished) {
        (true, true) => Unimock::new((base, no_grant_outcome(), uploads_expire())),
        (true, false) => Unimock::new((base, no_grant_outcome())),
        (false, _) => Unimock::new((base, uploads_expire())),
    };
    let credentials = Unimock::new(
        TokensMock::repository_read
            .some_call(matching!(1, 100))
            .returns(case.token.map(|token| Secret::new(token.into()))),
    );
    let runner: Arc<dyn BuildRunner> = match case.outcome {
        Some(outcome) => {
            let outcome = std::sync::Mutex::new(Some(outcome));
            Arc::new(Unimock::new(
                BuildRunnerMock::run
                    .some_call(matching!(_, _))
                    .answers_arc(Arc::new(move |_, _, _| {
                        let outcome = outcome.lock().unwrap().take().unwrap();
                        Box::pin(async move { outcome })
                    })),
            ))
        }
        None => Arc::new(Unimock::new(())),
    };
    let worker = worker(queries, Arc::new(credentials), runner, clock(), 4);
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("attempt required");
    };
    let (warnings, dispatch) = capture();
    worker
        .execute(*attempt)
        .with_subscriber(dispatch)
        .await
        .unwrap();
    warnings.events()
}

#[tokio::test]
async fn committed_infrastructure_endings_warn_once_with_attempt_and_reason() {
    let completed = "runner completed without a publication; upload grant outcome: none";
    for (case, expected) in [
        (
            Attempt::runner(1, BuildOutcome::Completed),
            warning(1, false, completed),
        ),
        (
            Attempt::runner(5, BuildOutcome::Completed),
            warning(5, true, completed),
        ),
        (
            Attempt::token(Err(Error::Unavailable)),
            warning(
                1,
                false,
                "repository token mint failed: [mkc-github-interface/error] unavailable",
            ),
        ),
        (
            Attempt::token(Err(Error::internal(ProviderBody))),
            warning(
                1,
                false,
                "repository token mint failed: [mkc-github-interface/error] internal",
            ),
        ),
        (
            Attempt::token(Ok("")),
            warning(
                1,
                false,
                "build request invalid: [mkc-build-interface/error] invalid request field: Credential",
            ),
        ),
    ] {
        assert_eq!(execute(case).await, [expected]);
    }
}

#[tokio::test]
async fn other_endings_publications_and_lost_fences_do_not_warn() {
    let install = BuildOutcome::StepFailed {
        step: BuildStep::Install,
        exit_code: Some(2),
        cli_error: None,
    };
    let published = Attempt {
        published: true,
        ..Attempt::runner(1, BuildOutcome::Completed)
    };
    let lost = Attempt {
        finished: false,
        ..Attempt::runner(1, BuildOutcome::Completed)
    };
    for case in [Attempt::runner(1, install), published, lost] {
        assert_eq!(execute(case).await, []);
    }
}

fn recover(running: Build) -> Vec<BTreeMap<String, String>> {
    let queries = Unimock::new((
        BuildsMock::claim_build
            .some_call(matching!(_))
            .returns(Ok(Some(running))),
        uploads_expire(),
        BuildsMock::finish_build
            .some_call(matching!(_, _, _))
            .returns(Ok(true)),
    ));
    let worker = worker(
        queries,
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        Arc::new(Unimock::new(())),
        4,
    );
    let (warnings, dispatch) = capture();
    let claim = tracing::dispatcher::with_default(&dispatch, || worker.claim().unwrap());
    assert!(matches!(claim, BuildClaim::Handled));
    warnings.events()
}

#[test]
fn lease_recovery_warns_with_the_last_step_unless_published() {
    for (number, step, published, expected) in [
        (
            5,
            Some(build_state::BuildStep::Install),
            false,
            vec![warning(
                5,
                true,
                "attempt lease expired during the install step",
            )],
        ),
        (
            1,
            None,
            false,
            vec![warning(
                1,
                false,
                "attempt lease expired before any step started",
            )],
        ),
        (1, Some(build_state::BuildStep::Publish), true, vec![]),
    ] {
        let mut running = build(BuildState::Running);
        running.attempt = number;
        running.step = step;
        if published {
            running.publication_id = Some(uuid::Uuid::from_u128(7).into());
        }
        assert_eq!(recover(running), expected);
    }
}
