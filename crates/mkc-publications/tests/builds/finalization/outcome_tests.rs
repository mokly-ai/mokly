//! Every runner outcome persists; a committed publication wins over every one.

use chrono::Duration;
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_state::BuildState;

use super::cases::cases;
use super::support::{assert_finished, assert_started, controlled_fixture, runner, schedule};

#[tokio::test(flavor = "multi_thread")]
async fn every_lifecycle_outcome_finalizes_with_and_without_a_publication() {
    let Some((fixture, _)) = controlled_fixture() else {
        return;
    };
    for published in [false, true] {
        for (index, case) in cases().into_iter().enumerate() {
            let id = schedule(&fixture, index + usize::from(published) * 100);
            let worker = fixture.worker(
                runner(&fixture, case.outcome, case.step, None, published),
                4,
            );
            let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
                panic!("case {index}, published {published} must start");
            };
            assert_started(&fixture, id, 1, 2);
            worker.execute(*attempt).await.unwrap();
            let (state, cause, exit) = if published {
                (BuildState::Published, None, None)
            } else {
                (case.state, case.cause, case.exit)
            };
            let version = if case.step.is_some() { 4 } else { 3 };
            let build = assert_finished(&fixture, id, state, cause, exit, case.step, version);
            assert_eq!(build.publication_id.is_some(), published);
            assert_eq!(build.attempt, 1);
            let at = fixture.runtime.now();
            assert_eq!(
                build.next_attempt_at,
                if state == BuildState::Queued {
                    at + Duration::seconds(60)
                } else {
                    at
                }
            );
        }
    }
}
