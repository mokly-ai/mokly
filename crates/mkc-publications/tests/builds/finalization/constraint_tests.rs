//! Nullable exit codes belong to every failed cause and no other lifecycle state.

use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_attempt::BuildFinish;
use mkc_store_interface::build_state::{BuildFailure, BuildState};
use mkc_store_interface::store::Callback;

use super::support::{assert_finished, assert_started, controlled_fixture, schedule, snapshot};

#[test]
fn every_failed_cause_can_store_a_nullable_exit_code() {
    let Some((fixture, _)) = controlled_fixture() else {
        return;
    };
    let worker = fixture.claim_worker(4);
    for (index, cause) in [
        BuildFailure::Exit,
        BuildFailure::UploadRejected,
        BuildFailure::UnsupportedLockfile,
        BuildFailure::UnsupportedMoklyVersion,
        BuildFailure::UncommittedChanges,
        BuildFailure::OutputLimit,
        BuildFailure::PlanRequired,
        BuildFailure::Infrastructure,
        BuildFailure::RepositoryUnavailable,
    ]
    .into_iter()
    .enumerate()
    {
        for (code_index, exit_code) in [None, Some(17)].into_iter().enumerate() {
            let id = schedule(&fixture, index * 2 + code_index);
            let BuildClaim::Attempt(_attempt) = worker.claim().unwrap() else {
                panic!("{cause:?} must start");
            };
            assert_started(&fixture, id, 1, 2);
            let (build, _) = snapshot(&fixture, id);
            fixture.queries(&mut |queries| {
                assert!(
                    queries
                        .finish_build(
                            id,
                            build.lease_token,
                            &BuildFinish {
                                state: BuildState::Failed,
                                failure_cause: Some(cause),
                                exit_code,
                                at: fixture.runtime.now(),
                                next_attempt_at: fixture.runtime.now(),
                            },
                        )
                        .unwrap()
                );
            });
            assert_finished(
                &fixture,
                id,
                BuildState::Failed,
                Some(cause),
                exit_code,
                None,
                3,
            );
        }
    }
}

#[test]
fn nonfailed_exit_codes_reject_the_write_without_bumping_the_check() {
    let Some((fixture, _)) = controlled_fixture() else {
        return;
    };
    for (index, (state, cause)) in [
        (BuildState::Queued, None),
        (BuildState::TimedOut, Some(BuildFailure::Deadline)),
    ]
    .into_iter()
    .enumerate()
    {
        let id = schedule(&fixture, index);
        let BuildClaim::Attempt(_attempt) = fixture.claim_worker(4).claim().unwrap() else {
            panic!("must start");
        };
        assert_started(&fixture, id, 1, 2);
        let (build, _) = snapshot(&fixture, id);
        assert!(
            fixture
                .store
                .transaction(&mut Callback(&mut |queries| {
                    queries.finish_build(
                        id,
                        build.lease_token,
                        &BuildFinish {
                            state,
                            failure_cause: cause,
                            exit_code: Some(17),
                            at: fixture.runtime.now(),
                            next_attempt_at: fixture.runtime.now(),
                        },
                    )?;
                    Ok(())
                }))
                .is_err()
        );
        assert_started(&fixture, id, 1, 2);
    }
}
