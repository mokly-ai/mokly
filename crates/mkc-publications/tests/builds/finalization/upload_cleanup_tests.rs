//! Finalization and lease recovery close unfinished real uploads with their build transition.

use std::future;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use super::super::upload_exchange::UploadExchange;
use super::support::{controlled_fixture, schedule};

#[tokio::test(flavor = "multi_thread")]
async fn ending_attempts_expire_all_their_unfinished_uploads_and_release_references() {
    for recover in [false, true] {
        let Some((fixture, at)) = controlled_fixture() else {
            return;
        };
        let id = schedule(&fixture, 200);
        let uploads = Arc::new(Mutex::new(Vec::new()));
        let observed = uploads.clone();
        let upload = UploadExchange::create(&fixture);
        let (planned, received) = oneshot::channel();
        let planned = Mutex::new(Some(planned));
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, request, sink| {
                let upload = upload.clone();
                let observed = observed.clone();
                let planned = planned.lock().unwrap().take().unwrap();
                Box::pin(async move {
                    sink.step_started(request.attempt_operation_id, BuildStep::Publish)
                        .await
                        .unwrap();
                    let first = upload.begin(&request);
                    let second = upload.begin(&request);
                    observed.lock().unwrap().extend([first, second]);
                    planned.send(()).unwrap();
                    if recover {
                        future::pending().await
                    } else {
                        BuildOutcome::Completed
                    }
                })
            }),
        ));
        let worker = fixture.worker(Arc::new(runner), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("must start");
        };
        if recover {
            {
                let execution = worker.execute(*attempt);
                tokio::pin!(execution);
                tokio::select! {
                    result = &mut execution => panic!("run must stay pending: {result:?}"),
                    result = received => result.unwrap(),
                }
            }
            *at.lock().unwrap() += Duration::minutes(2);
            assert!(matches!(
                fixture.claim_worker(4).claim().unwrap(),
                BuildClaim::Handled
            ));
        } else {
            worker.execute(*attempt).await.unwrap();
        }
        fixture.queries(&mut |queries| {
            let build = queries.build(fixture.project.id, id).unwrap().unwrap();
            assert_eq!(
                build.state,
                mkc_store_interface::build_state::BuildState::Queued
            );
            for &publication in uploads.lock().unwrap().iter() {
                let row = queries.publication(publication).unwrap().unwrap();
                assert_eq!(row.state, PublicationState::Failed);
                assert_eq!(row.failure, Some(PublicationFailure::Expired));
                assert!(
                    queries
                        .publication_file(publication, "mokly-upload.json")
                        .unwrap()
                        .is_none()
                );
            }
            let blobs = queries
                .garbage_blobs(fixture.runtime.now() + Duration::days(2), 1000)
                .unwrap();
            assert!(!blobs.is_empty());
            assert!(blobs.iter().all(|blob| blob.ref_count == 0));
        });
    }
}
