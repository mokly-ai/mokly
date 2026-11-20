//! Claim-time repository and plan refusals use real queued finalization writes.

use mkc_domain::values::Visibility;
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build_state::{BuildFailure, BuildState};

use super::support::{assert_finished, controlled_fixture, schedule};

#[test]
fn claim_refusals_finalize_without_starting_an_attempt() {
    for unavailable in [true, false] {
        let Some((fixture, _)) = controlled_fixture() else {
            return;
        };
        let id = schedule(&fixture, 0);
        fixture.queries(&mut |queries| {
            if unavailable {
                let mut repository = fixture.repository.clone();
                repository.active = false;
                queries.save_github_repository(&repository).unwrap();
            } else {
                let mut project = fixture.project.clone();
                project.visibility = Visibility::Private;
                queries.save_project(&project).unwrap();
            }
        });
        assert!(matches!(
            fixture.claim_worker(4).claim().unwrap(),
            BuildClaim::Handled
        ));
        let cause = if unavailable {
            BuildFailure::RepositoryUnavailable
        } else {
            BuildFailure::PlanRequired
        };
        let build = assert_finished(&fixture, id, BuildState::Failed, Some(cause), None, None, 2);
        assert_eq!(build.attempt, 0);
        assert!(build.started_at.is_none());
        assert!(build.attempt_operation_id.is_none());
        fixture.queries(&mut |queries| {
            assert!(queries.build_attempt_grant(id, 1).unwrap().is_none());
        });
    }
}
