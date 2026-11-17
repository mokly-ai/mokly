//! Queued, running, published check sequence and persisted head-and-tail cap.

use std::sync::{Arc, Mutex};

use mkc_build_interface::log::{BuildLogChunk, BuildStream};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::BuildRunnerMock;
use mkc_github_interface::check::{CheckRuns, CheckRunsMock, Conclusion};
use mkc_github_interface::checks::Status;
use mkc_publications::build_check_worker::{BuildCheckDelivery, BuildChecksWorker};
use mkc_publications::build_scheduler::{
    BuildReference, BuildSchedule, BuildScheduler, DatabaseBuildScheduler,
};
use mkc_publications::build_worker::service::BuildClaim;
use mkc_publications::check_worker::PublicationChecks;
use mkc_publications::locations::Locations;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildTrigger};
use mkc_store_interface::github_refs::Branch;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use unimock::{MockFn, Unimock, matching};

use super::fixtures::Fixture;
use super::upload_exchange::{BuildUpload, UploadExchange};

#[tokio::test(flavor = "multi_thread")]
async fn real_worker_publishes_only_after_its_grant_upload_and_delivers_its_check_sequence() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    let id = fixture.runtime.id().into();
    let schedule = BuildSchedule {
        id,
        project_id: fixture.project.id,
        trigger: BuildTrigger::Push,
        at: fixture.runtime.now(),
        rerun_base_ref: None,
        reference: BuildReference::Branch(Branch {
            repository_id: fixture.repository.id,
            name: "main".into(),
            head_sha: Some("a".repeat(40)),
            updated_at: fixture.runtime.now(),
        }),
    };
    let scheduler: &dyn BuildScheduler = &DatabaseBuildScheduler { configured: true };
    fixture
        .transactions
        .run(false, &mut |queries| {
            assert_eq!(scheduler.schedule(queries, &schedule)?, Some(id));
            Ok(())
        })
        .unwrap();
    let delivered = Arc::new(Mutex::new(Vec::new()));
    let observed = delivered.clone();
    let github: Arc<dyn CheckRuns> = Arc::new(Unimock::new(
        CheckRunsMock::upsert
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, check| {
                observed.lock().unwrap().push(check.clone());
                Ok(())
            })),
    ));
    let locations = Locations {
        app_origin: "https://app.example.com".into(),
        catalogue_domain: "catalogues.example.net".into(),
        catalogue_scheme: "https".into(),
        catalogue_port: None,
    };
    let publications = Arc::new(PublicationChecks {
        transactions: fixture.transactions.clone(),
        files: fixture.files.clone(),
        github: github.clone(),
        runtime: fixture.runtime.clone(),
        locations: locations.clone(),
    });
    let checks: Arc<dyn BuildChecksWorker> = Arc::new(BuildCheckDelivery {
        transactions: fixture.transactions.clone(),
        github,
        publications,
        runtime: fixture.runtime.clone(),
        locations,
    });
    assert_eq!(checks.run_batch(Some(fixture.project.id)).unwrap(), 1);
    let upload: Arc<dyn BuildUpload> = UploadExchange::create(&fixture);
    let result = Arc::new(Mutex::new(None));
    let publication_result = result.clone();
    let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
        Arc::new(move |_, request, sink| {
            let upload = upload.clone();
            let result = publication_result.clone();
            Box::pin(async move {
                for step in [BuildStep::Checkout, BuildStep::Install, BuildStep::Publish] {
                    sink.step_started(request.attempt_operation_id, step)
                        .await
                        .unwrap();
                }
                for _ in 0..20 {
                    sink.write(BuildLogChunk {
                        attempt_operation_id: request.attempt_operation_id,
                        step: BuildStep::Publish,
                        stream: BuildStream::Stdout,
                        bytes: vec![b'x'; 65_536],
                    })
                    .await
                    .unwrap();
                }
                let unfinished = upload.begin(&request);
                *result.lock().unwrap() = Some((unfinished, upload.commit(&request)));
                BuildOutcome::StepFailed {
                    step: BuildStep::Publish,
                    exit_code: Some(1),
                    cli_error: None,
                }
            })
        }),
    ));
    let worker = fixture.worker(Arc::new(runner), 4);
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("must start");
    };
    assert_eq!(checks.run_batch(Some(fixture.project.id)).unwrap(), 1);
    worker.execute(*attempt).await.unwrap();
    assert_eq!(checks.run_batch(Some(fixture.project.id)).unwrap(), 1);
    fixture.queries(&mut |queries| {
        let build = queries.build(fixture.project.id, id).unwrap().unwrap();
        assert_eq!(build.state, BuildState::Published);
        let (unfinished, ready) = result.lock().unwrap().unwrap();
        assert_eq!(build.publication_id, Some(ready));
        let expired = queries.publication(unfinished).unwrap().unwrap();
        assert_eq!(expired.state, PublicationState::Failed);
        assert_eq!(expired.failure, Some(PublicationFailure::Expired));
        assert!(
            queries
                .publication_file(unfinished, "mokly-upload.json")
                .unwrap()
                .is_none()
        );
        assert!(
            queries
                .publication_file(ready, "mokly-upload.json")
                .unwrap()
                .is_some()
        );
        assert_eq!(build.step.unwrap().as_str(), "publish");
        assert!(build.log_complete);
        assert_eq!(build.log_bytes, 1_048_576);
        assert_eq!(build.log_elided_bytes, 262_144);
        let head = queries
            .build_log(fixture.project.id, id, 0, 100)
            .unwrap()
            .unwrap();
        assert_eq!(head.head_sequence, 4);
    });
    let values = delivered.lock().unwrap();
    assert_eq!(
        values.iter().map(|value| value.status).collect::<Vec<_>>(),
        [Status::Queued, Status::InProgress, Status::Completed]
    );
    assert_eq!(values[2].conclusion, Some(Conclusion::Neutral));
    assert!(
        values
            .iter()
            .all(|check| check.external_id == format!("mokly-build:{id}")
                && check.details_url.ends_with(&format!("/builds/{id}")))
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn a_real_rejected_build_upload_finishes_failed_with_its_publish_exit_code() {
    let Some(fixture) = Fixture::create() else {
        return;
    };
    let id = fixture.runtime.id().into();
    fixture.queries(&mut |queries| {
        queries
            .schedule_build(&NewBuild {
                id,
                project_id: fixture.project.id,
                repository_id: fixture.repository.id,
                trigger: BuildTrigger::Request,
                branch: "main".into(),
                head_sha: "b".repeat(40),
                pull_request: None,
                base_ref: None,
                config_path: fixture.project.config_path.clone(),
                created_at: fixture.runtime.now(),
            })
            .unwrap();
    });
    let upload = UploadExchange::create(&fixture);
    let runner = Unimock::new(BuildRunnerMock::run.some_call(matching!(_, _)).answers_arc(
        Arc::new(move |_, request, sink| {
            let upload = upload.clone();
            Box::pin(async move {
                sink.step_started(request.attempt_operation_id, BuildStep::Publish)
                    .await
                    .unwrap();
                upload.reject(&request);
                BuildOutcome::StepFailed {
                    step: BuildStep::Publish,
                    exit_code: Some(23),
                    cli_error: None,
                }
            })
        }),
    ));
    let worker = fixture.worker(Arc::new(runner), 4);
    let BuildClaim::Attempt(attempt) = worker.claim().unwrap() else {
        panic!("must start");
    };
    worker.execute(*attempt).await.unwrap();
    fixture.queries(&mut |queries| {
        let build = queries.build(fixture.project.id, id).unwrap().unwrap();
        assert_eq!(build.state, BuildState::Failed);
        assert_eq!(build.failure_cause, Some(BuildFailure::UploadRejected));
        assert_eq!(build.exit_code, Some(23));
        assert!(build.publication_id.is_none());
    });
}
