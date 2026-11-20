//! Controlled time, fake execution and assertions over the real Postgres store.

use std::sync::{Arc, Mutex};

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_build_interface::log::{BuildLogChunk, BuildStream};
use mkc_build_interface::outcome::{BuildOutcome, BuildStep};
use mkc_build_interface::runner::{BuildRunner, BuildRunnerMock};
use mkc_domain::ids::BuildId;
use mkc_store_interface::build::{Build, NewBuild};
use mkc_store_interface::build_check::BuildCheck;
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildTrigger, UploadOutcome};
use mkc_store_interface::store::Callback;
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use super::super::fixtures::Fixture;
use super::super::upload_exchange::{BuildUpload, UploadExchange};

pub(super) fn controlled_fixture() -> Option<(Fixture, Arc<Mutex<DateTime<Utc>>>)> {
    let at = Arc::new(Mutex::new(
        DateTime::from_timestamp_micros(Utc::now().timestamp_micros()).unwrap(),
    ));
    let observed = at.clone();
    let runtime: Arc<dyn Runtime> = Arc::new(Unimock::new((
        RuntimeMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| *observed.lock().unwrap())),
        RuntimeMock::id
            .each_call(matching!())
            .answers(&|_| Uuid::now_v7()),
        RuntimeMock::secret.each_call(matching!()).answers(&|_| {
            Ok(format!(
                "{}{}",
                Uuid::now_v7().simple(),
                Uuid::now_v7().simple()
            ))
        }),
    )));
    Some((Fixture::create_with_runtime(runtime)?, at))
}

pub(super) fn schedule(fixture: &Fixture, index: usize) -> BuildId {
    let id = fixture.runtime.id().into();
    fixture.queries(&mut |queries| {
        queries
            .schedule_build(&NewBuild {
                id,
                project_id: fixture.project.id,
                repository_id: fixture.repository.id,
                trigger: BuildTrigger::Request,
                branch: format!("case-{index}"),
                head_sha: format!("{index:040x}"),
                pull_request: None,
                base_ref: None,
                config_path: fixture.project.config_path.clone(),
                created_at: fixture.runtime.now(),
            })
            .unwrap();
    });
    let (build, check) = snapshot(fixture, id);
    assert_eq!(build.state, BuildState::Queued);
    assert_eq!(build.attempt, 0);
    assert!(!build.log_complete);
    assert_eq!(check.version, 1);
    id
}

pub(super) fn snapshot(fixture: &Fixture, id: BuildId) -> (Build, BuildCheck) {
    let mut result = None;
    fixture.queries(&mut |queries| {
        let build = queries.build(fixture.project.id, id).unwrap().unwrap();
        let check = queries
            .pending_build_checks(fixture.runtime.now(), 100, Some(fixture.project.id))
            .unwrap()
            .into_iter()
            .find(|check| check.build_id == id)
            .expect("the changed build must have a due check");
        result = Some((build, check));
    });
    result.unwrap()
}

pub(super) fn assert_started(fixture: &Fixture, id: BuildId, attempt: i32, version: i64) {
    let (build, check) = snapshot(fixture, id);
    assert_eq!(build.state, BuildState::Running);
    assert_eq!(build.attempt, attempt);
    assert!(build.step.is_none());
    assert!(build.failure_cause.is_none());
    assert!(build.exit_code.is_none());
    assert!(!build.log_complete);
    assert!(build.lease_token.is_some());
    assert_eq!(
        build.lease_expires_at,
        Some(fixture.runtime.now() + Duration::minutes(2))
    );
    assert_eq!(check.version, version);
    fixture.queries(&mut |queries| {
        let grant = queries.build_attempt_grant(id, attempt).unwrap().unwrap();
        assert_eq!(grant.attempt, attempt);
        assert_eq!(grant.expires_at, build.deadline_at.unwrap());
    });
}

pub(super) fn assert_finished(
    fixture: &Fixture,
    id: BuildId,
    state: BuildState,
    cause: Option<BuildFailure>,
    exit: Option<i32>,
    step: Option<BuildStep>,
    version: i64,
) -> Build {
    let (build, check) = snapshot(fixture, id);
    assert_eq!(
        (
            build.state,
            build.failure_cause,
            build.exit_code,
            build.step.map(|value| value.as_str()),
            build.log_complete,
        ),
        (
            state,
            cause,
            exit,
            step.map(|value| match value {
                BuildStep::Checkout => "checkout",
                BuildStep::Install => "install",
                BuildStep::Publish => "publish",
            }),
            true,
        ),
        "build {id}"
    );
    assert!(build.lease_token.is_none());
    assert!(build.lease_expires_at.is_none());
    assert_eq!(build.finished_at.is_some(), state != BuildState::Queued);
    assert_eq!(check.version, version, "build {id} check bump");
    assert_eq!(check.delivered_version, 0);
    build
}

pub(super) fn runner(
    fixture: &Fixture,
    outcome: BuildOutcome,
    step: Option<BuildStep>,
    grant_outcome: Option<UploadOutcome>,
    published: bool,
) -> Arc<dyn BuildRunner> {
    let outcome = Arc::new(Mutex::new(Some(outcome)));
    let store = fixture.store.clone();
    let upload: Arc<dyn BuildUpload> = UploadExchange::create(fixture);
    Arc::new(Unimock::new(
        BuildRunnerMock::run
            .some_call(matching!(_, _))
            .answers_arc(Arc::new(move |_, request, sink| {
                let outcome = outcome.lock().unwrap().take().unwrap();
                let store = store.clone();
                let upload = upload.clone();
                Box::pin(async move {
                    if let Some(step) = step {
                        sink.step_started(request.attempt_operation_id, step)
                            .await
                            .unwrap();
                        sink.write(BuildLogChunk {
                            attempt_operation_id: request.attempt_operation_id,
                            step,
                            stream: BuildStream::Stderr,
                            bytes: b"command output\n".to_vec(),
                        })
                        .await
                        .unwrap();
                    }
                    if let Some(value) = grant_outcome {
                        store
                            .transaction(&mut Callback(&mut |queries| {
                                let build = queries.build_by_id(request.build_id.into())?.unwrap();
                                let grant = queries
                                    .build_attempt_grant(build.id, build.attempt)?
                                    .unwrap();
                                assert!(queries.record_build_upload_outcome(grant.id, value)?);
                                Ok(())
                            }))
                            .unwrap();
                    }
                    if published {
                        upload.commit(&request);
                    }
                    outcome
                })
            })),
    ))
}
