//! Cancellation and supersession close real uploads before retention runs.

use std::future;
use std::sync::{Arc, Mutex};

use chrono::Duration;
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_publications::build_worker::service::BuildClaim;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::{BuildState, BuildTrigger};
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::publication_event::EventKind;
use tokio::sync::oneshot;
use unimock::{MockFn, Unimock, matching};

use super::super::upload_exchange::UploadExchange;
use super::support::{controlled_fixture, schedule};

#[tokio::test(flavor = "multi_thread")]
async fn cancelled_and_superseded_builds_release_uploads_before_pruning() {
    for supersede in [false, true] {
        let Some((fixture, at)) = controlled_fixture() else {
            return;
        };
        let id = schedule(&fixture, 201);
        let upload = UploadExchange::create(&fixture);
        let uploads = Arc::new(Mutex::new(Vec::new()));
        let observed = uploads.clone();
        let (planned, received) = oneshot::channel();
        let planned = Mutex::new(Some(planned));
        let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
            Arc::new(move |_, request, _| {
                let upload = upload.clone();
                let observed = observed.clone();
                let planned = planned.lock().unwrap().take().unwrap();
                Box::pin(async move {
                    observed
                        .lock()
                        .unwrap()
                        .extend([upload.begin(&request), upload.begin(&request)]);
                    planned.send(()).unwrap();
                    future::pending().await
                })
            }),
        ));
        let worker = fixture.worker(Arc::new(runner), 4);
        let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
            panic!("must start")
        };
        let execution = worker.execute(*attempt);
        tokio::pin!(execution);
        tokio::select! {
            result = &mut execution => panic!("run must wait: {result:?}"),
            result = received => result.unwrap(),
        }
        let mut reserved = Vec::new();
        fixture.queries(&mut |q| {
            for &publication in uploads.lock().unwrap().iter() {
                let event = q
                    .publication(publication)
                    .unwrap()
                    .unwrap()
                    .build_failure_event_id
                    .unwrap();
                assert_eq!(event.get_version_num(), 7);
                reserved.push((publication, event));
            }
        });
        let replacement = fixture.runtime.id().into();
        fixture.queries(&mut |q| {
            if supersede {
                q.schedule_build(&NewBuild {
                    id: replacement,
                    project_id: fixture.project.id,
                    repository_id: fixture.repository.id,
                    trigger: BuildTrigger::Request,
                    branch: "case-201".into(),
                    head_sha: "f".repeat(40),
                    pull_request: None,
                    base_ref: None,
                    config_path: fixture.project.config_path.clone(),
                    created_at: fixture.runtime.now(),
                })
                .unwrap();
            } else {
                q.cancel_build(fixture.project.id, id, fixture.runtime.now())
                    .unwrap();
            }
            let build = q.build(fixture.project.id, id).unwrap().unwrap();
            assert_eq!(
                build.state,
                if supersede {
                    BuildState::Superseded
                } else {
                    BuildState::Cancelled
                }
            );
            let events = q
                .pending_publication_events(fixture.runtime.now(), 1000, None)
                .unwrap();
            for &publication in uploads.lock().unwrap().iter() {
                let row = q.publication(publication).unwrap().unwrap();
                assert_eq!(row.state, PublicationState::Failed);
                assert_eq!(row.failure, Some(PublicationFailure::Expired));
                assert!(
                    q.publication_file(publication, "mokly-upload.json")
                        .unwrap()
                        .is_none()
                );
                let failed: Vec<_> = events
                    .iter()
                    .filter(|event| {
                        event.event.publication_id == publication
                            && event.event.kind == EventKind::Failed
                    })
                    .collect();
                assert_eq!(failed.len(), 1);
                assert_eq!(
                    failed[0].event.id,
                    reserved
                        .iter()
                        .find(|(id, _)| *id == publication)
                        .unwrap()
                        .1
                );
                assert_eq!(failed[0].event.created_at, fixture.runtime.now());
            }
            let blobs = q
                .garbage_blobs(fixture.runtime.now() + Duration::days(2), 1000)
                .unwrap();
            assert!(!blobs.is_empty());
            assert!(blobs.iter().all(|blob| blob.ref_count == 0));
            assert_eq!(
                q.prune_builds(fixture.runtime.now() + Duration::days(31), 1000)
                    .unwrap(),
                1
            );
            assert!(q.build(fixture.project.id, id).unwrap().is_none());
            for &publication in uploads.lock().unwrap().iter() {
                assert!(q.publication(publication).unwrap().is_none());
            }
            if supersede {
                assert_eq!(
                    q.build(fixture.project.id, replacement)
                        .unwrap()
                        .unwrap()
                        .state,
                    BuildState::Queued
                );
            }
        });
        *at.lock().unwrap() += Duration::minutes(1);
    }
}
