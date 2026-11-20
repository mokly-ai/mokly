//! Real retry starts, due boundaries and exhaustion after five infrastructure failures.

use std::io;

use chrono::Duration;
use mkc_build_interface::error::Error;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_state::{BuildFailure, BuildState};

use super::support::{
    assert_finished, assert_started, controlled_fixture, runner, schedule, snapshot,
};

#[tokio::test(flavor = "multi_thread")]
async fn infrastructure_retries_obey_backoff_and_exhaust_on_the_fifth_attempt() {
    let Some((fixture, at)) = controlled_fixture() else {
        return;
    };
    let id = schedule(&fixture, 0);
    let mut version = 1;
    let mut operation = None;
    for attempt_number in 1..=5 {
        let step = Some(BuildStep::Checkout);
        let worker = fixture.worker(
            runner(
                &fixture,
                BuildOutcome::Infrastructure(
                    Error::internal(io::Error::other("fake runner failure")).into_internal(),
                ),
                step,
                None,
                false,
            ),
            4,
        );
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt {attempt_number} must start");
        };
        version += 1;
        assert_started(&fixture, id, attempt_number, version);
        let (started, _) = snapshot(&fixture, id);
        assert_ne!(started.attempt_operation_id, operation);
        operation = started.attempt_operation_id;
        assert_eq!(started.log_bytes, 0);
        assert_eq!(started.log_sequence, i64::from(attempt_number - 1));
        fixture.queries(&mut |queries| {
            let log = queries
                .build_log(fixture.project.id, id, 0, 100)
                .unwrap()
                .unwrap();
            assert!(log.chunks.is_empty());
        });
        worker.execute(*attempt).await.unwrap();
        version += 2;
        let (state, cause) = if attempt_number == 5 {
            (BuildState::Failed, Some(BuildFailure::Infrastructure))
        } else {
            (BuildState::Queued, None)
        };
        let build = assert_finished(&fixture, id, state, cause, None, step, version);
        assert_eq!(build.attempt, attempt_number);
        assert_eq!(build.log_sequence, i64::from(attempt_number));
        assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
        if attempt_number < 5 {
            let delay = Duration::seconds(60 << (attempt_number - 1));
            assert_eq!(build.next_attempt_at, fixture.runtime.now() + delay);
            *at.lock().unwrap() += delay - Duration::microseconds(1);
            assert!(matches!(worker.claim().unwrap(), BuildClaim::Idle));
            assert_eq!(snapshot(&fixture, id).1.version, version);
            *at.lock().unwrap() += Duration::microseconds(1);
        } else {
            assert_eq!(build.finished_at, Some(fixture.runtime.now()));
        }
    }
}
