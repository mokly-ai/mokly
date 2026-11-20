//! Attempt and lease fences at the runner's step and output sink boundary.

use std::sync::Arc;

use mkc_build_interface::log::{BuildLogChunk, BuildStream};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_domain::values::Plan;
use mkc_github_interface::credentials::{Secret, TokensMock};
use mkc_store_interface::build::BuildsMock;
use mkc_store_interface::build_log::BuildLogsMock;
use mkc_store_interface::build_state::BuildState;
use unimock::{MockFn, Unimock, matching};

use crate::build_worker::service::BuildClaim;
use crate::tests::build_fixtures::*;

use super::support::{clock, start_queries, worker};

#[tokio::test]
async fn stale_operation_output_is_discarded_and_a_lost_step_fence_fails() {
    for wrong_operation in [true, false] {
        let common = || {
            (
                eligibility(
                    Some(project()),
                    Some(repository()),
                    Some(installation()),
                    Plan::Free,
                ),
                start_queries(),
                BuildsMock::build
                    .some_call(matching!(_, _))
                    .returns(Ok(Some(build(BuildState::Cancelled)))),
            )
        };
        let queries = if wrong_operation {
            Unimock::new(common())
        } else {
            Unimock::new((
                common(),
                BuildsMock::set_build_step
                    .some_call(matching!(_, _, _, _))
                    .answers(&|_, id, lease, step, _| {
                        assert_eq!((id, lease), (BUILD, LEASE));
                        assert_eq!(step.as_str(), "publish");
                        Ok(false)
                    }),
                BuildLogsMock::append_build_log
                    .some_call(matching!(_, _))
                    .answers(&|_, id, chunk| {
                        assert_eq!(id, BUILD);
                        assert_eq!(chunk.attempt_operation_id, LEASE);
                        assert_eq!(chunk.stream.as_str(), "stderr");
                        Ok(false)
                    }),
            ))
        };
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, request, sink| {
                Box::pin(async move {
                    let operation = if wrong_operation {
                        OPERATION
                    } else {
                        request.attempt_operation_id
                    };
                    assert!(
                        sink.step_started(operation, BuildStep::Publish)
                            .await
                            .is_err()
                    );
                    sink.write(BuildLogChunk {
                        attempt_operation_id: operation,
                        step: BuildStep::Publish,
                        stream: BuildStream::Stderr,
                        bytes: b"late redacted output".to_vec(),
                    })
                    .await
                    .unwrap();
                    BuildOutcome::Completed
                })
            }),
        ));
        let credentials = Unimock::new(
            TokensMock::repository_read
                .some_call(matching!(1, 100))
                .returns(Ok(Secret::new("scoped".into()))),
        );
        let worker = worker(queries, Arc::new(credentials), Arc::new(runner), clock(), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("attempt required");
        };
        worker.execute(*attempt).await.unwrap();
    }
}
