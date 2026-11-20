//! Expired leases finish committed uploads and retry or exhaust unfinished runs.

use std::future;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_build_interface::outcome::BuildStep;
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_state::{self, BuildFailure, BuildState};
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use super::super::upload_exchange::{BuildUpload, UploadExchange};

use super::support::{assert_finished, assert_started, controlled_fixture, schedule, snapshot};

#[tokio::test(flavor = "multi_thread")]
async fn lease_recovery_publishes_a_committed_upload_without_runner_finalization() {
    let Some((fixture, at)) = controlled_fixture() else {
        return;
    };
    let id = schedule(&fixture, 0);
    let worker = fixture.claim_worker(4);
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("must start");
    };
    assert_started(&fixture, id, 1, 2);
    let upload: Arc<dyn BuildUpload> = UploadExchange::create(&fixture);
    let (committed, received) = oneshot::channel();
    let committed = Mutex::new(Some(committed));
    let recovering_runner = Unimock::new(
        BuildRunnerMock::run
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, sink| {
                let upload = upload.clone();
                let committed = committed.lock().unwrap().take().unwrap();
                Box::pin(async move {
                    sink.step_started(request.attempt_operation_id, BuildStep::Publish)
                        .await
                        .unwrap();
                    upload.commit(&request);
                    committed.send(()).unwrap();
                    future::pending().await
                })
            })),
    );
    let executing = fixture.worker(Arc::new(recovering_runner), 4);
    {
        let execution = executing.execute(*attempt);
        tokio::pin!(execution);
        tokio::select! {
            result = &mut execution => panic!("run must stay pending: {result:?}"),
            result = received => result.unwrap(),
        }
    }
    let (running, check) = snapshot(&fixture, id);
    assert_eq!(running.state, BuildState::Running);
    assert!(running.publication_id.is_some());
    assert!(!running.log_complete);
    assert_eq!(check.version, 3);
    *at.lock().unwrap() += Duration::minutes(2);
    assert!(matches!(
        fixture.claim_worker(4).claim().unwrap(),
        BuildClaim::Handled
    ));
    let build = assert_finished(
        &fixture,
        id,
        BuildState::Published,
        None,
        None,
        Some(BuildStep::Publish),
        4,
    );
    assert!(build.publication_id.is_some());
}

#[test]
fn lease_recovery_requeues_four_attempts_with_backoff_then_exhausts() {
    let Some((fixture, at)) = controlled_fixture() else {
        return;
    };
    let id = schedule(&fixture, 0);
    let worker = fixture.claim_worker(4);
    let mut version = 1;
    for attempt_number in 1..=5 {
        {
            let BuildClaim::Attempt(_attempt) = worker.claim().unwrap() else {
                panic!("attempt {attempt_number} must start");
            };
            version += 1;
            assert_started(&fixture, id, attempt_number, version);
            fixture.queries(&mut |queries| {
                let build = queries.build(fixture.project.id, id).unwrap().unwrap();
                assert!(
                    queries
                        .set_build_step(
                            id,
                            build.lease_token.unwrap(),
                            build_state::BuildStep::Checkout,
                            fixture.runtime.now(),
                        )
                        .unwrap()
                );
            });
            version += 1;
        }
        *at.lock().unwrap() += Duration::minutes(2);
        assert!(matches!(worker.claim().unwrap(), BuildClaim::Handled));
        version += 1;
        let state = if attempt_number == 5 {
            BuildState::Failed
        } else {
            BuildState::Queued
        };
        let cause = (attempt_number == 5).then_some(BuildFailure::Infrastructure);
        let build = assert_finished(
            &fixture,
            id,
            state,
            cause,
            None,
            Some(BuildStep::Checkout),
            version,
        );
        assert!(build.publication_id.is_none());
        if attempt_number < 5 {
            let delay = Duration::seconds(60 << (attempt_number - 1));
            assert_eq!(build.next_attempt_at, fixture.runtime.now() + delay);
            assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
            *at.lock().unwrap() += delay;
        }
    }
    assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
}
