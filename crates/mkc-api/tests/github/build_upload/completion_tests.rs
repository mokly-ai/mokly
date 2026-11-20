//! Ready and replay consumption, repeated receipts and parallel blob request outcomes.

use std::thread;

use chrono::{Duration, Utc};
use mkc_domain::ids::PublicationId;
use mkc_store_interface::build_state::UploadOutcome;
use reqwest::Method;
use uuid::Uuid;

use super::super::harness::{Harness, json};
use super::support::{
    blob, catalogue, complete, outcome, plan, refusal, send_blobs, start, upload_id,
};

#[test]
fn a_ready_completion_consumes_the_grant_and_only_its_201_can_repeat() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 30, Duration::zero(), Some(42));
    let catalogue = catalogue(&attempt, None);
    let planned = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let id = upload_id(&planned);
    assert_eq!(outcome(&app, &attempt), None);
    refusal(
        complete(&app, &attempt, id),
        409,
        "upload-incomplete",
        &attempt.bearer,
    );
    send_blobs(&app, &attempt, &planned, &catalogue);
    let receipt = json(complete(&app, &attempt, id), 201);
    assert_eq!(receipt["buildId"], attempt.id.to_string());
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Accepted));
    app.queries(&mut |queries| {
        let grant = queries.build_attempt_grant(attempt.id, 1).unwrap().unwrap();
        assert_eq!(grant.id, attempt.grant);
        assert!(grant.consumed_at.is_some());
        let build = queries.build(project.id, attempt.id).unwrap().unwrap();
        assert_eq!(build.publication_id, Some(id));
        let publication = queries.publication(id).unwrap().unwrap();
        assert_eq!(publication.metadata.unwrap().pull_request, Some(42));
    });
    assert_eq!(json(complete(&app, &attempt, id), 201), receipt);
    refusal(
        plan(&app, &attempt, catalogue.plan),
        401,
        "upload-unauthorized",
        &attempt.bearer,
    );
    refusal(
        blob(&app, &attempt, id, &"a".repeat(64), vec![1]),
        401,
        "upload-unauthorized",
        &attempt.bearer,
    );
    refusal(
        complete(&app, &attempt, Uuid::now_v7().into()),
        401,
        "upload-unauthorized",
        &attempt.bearer,
    );
    app.queries(&mut |queries| {
        let build = queries.build(project.id, attempt.id).unwrap().unwrap();
        assert!(
            queries
                .finish_build(
                    attempt.id,
                    build.lease_token,
                    &mkc_store_interface::build_attempt::BuildFinish {
                        state: mkc_store_interface::build_state::BuildState::Published,
                        failure_cause: None,
                        exit_code: None,
                        at: Utc::now(),
                        next_attempt_at: Utc::now(),
                    }
                )
                .unwrap()
        );
    });
    assert_eq!(json(complete(&app, &attempt, id), 201), receipt);
    let viewer = json(
        app.request(
            Method::GET,
            &format!("/v1/projects/{}/publications/{id}", project.id),
        )
        .send()
        .unwrap(),
        200,
    );
    assert_eq!(viewer["buildId"], attempt.id.to_string());
    let branches = json(
        app.request(
            Method::GET,
            &format!("/v1/projects/{}/branches", project.id),
        )
        .send()
        .unwrap(),
        200,
    );
    assert_eq!(
        branches["items"][0]["newestPublication"]["buildId"],
        attempt.id.to_string()
    );
    app.queries(&mut |queries| {
        assert!(queries.expire_publication(id, Utc::now()).unwrap());
    });
    let expired = json(complete(&app, &attempt, id), 201);
    assert_eq!(expired["state"], "expired");
    assert_eq!(expired["id"], receipt["id"]);
}

#[test]
fn a_plan_replay_consumes_its_grant_only_when_its_completion_answers_200() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 40, Duration::zero(), None);
    let winner = app.publish(project.id, "octocat/Hello-World", &attempt.head);
    let catalogue = catalogue(&attempt, None);
    let planned = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    assert!(planned["missing"].as_array().unwrap().is_empty());
    app.queries(&mut |queries| {
        assert!(
            queries
                .build_attempt_grant(attempt.id, 1)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_none()
        );
    });
    let id = upload_id(&planned);
    let receipt = json(complete(&app, &attempt, id), 200);
    assert_eq!(receipt["id"], winner.to_string());
    assert!(receipt["buildId"].is_null());
    app.queries(&mut |queries| {
        assert_eq!(
            queries
                .build(project.id, attempt.id)
                .unwrap()
                .unwrap()
                .publication_id,
            Some(winner)
        );
        assert!(
            queries
                .build_attempt_grant(attempt.id, 1)
                .unwrap()
                .unwrap()
                .consumed_at
                .is_some()
        );
    });
    refusal(
        complete(&app, &attempt, id),
        401,
        "upload-unauthorized",
        &attempt.bearer,
    );
    refusal(
        complete(&app, &attempt, winner),
        401,
        "upload-unauthorized",
        &attempt.bearer,
    );
}

#[test]
fn parallel_blob_answers_keep_a_refusal_until_a_completion_accepts_the_upload() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let attempt = start(&app, &project, 50, Duration::zero(), None);
    let catalogue = catalogue(&attempt, None);
    let planned = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let id: PublicationId = upload_id(&planned);
    let sibling = json(plan(&app, &attempt, catalogue.plan.clone()), 200);
    let sibling_id = upload_id(&sibling);
    app.queries(&mut |queries| {
        assert!(
            queries
                .fail_publication(
                    sibling_id,
                    mkc_store_interface::publication::PublicationFailure::Expired
                )
                .unwrap()
        );
        queries.delete_publication_files(sibling_id).unwrap();
    });
    thread::scope(|scope| {
        for hash in planned["missing"].as_array().unwrap() {
            let hash = hash.as_str().unwrap();
            let bytes = catalogue.blobs[hash].clone();
            let app = &app;
            let attempt = &attempt;
            scope.spawn(move || {
                assert_eq!(blob(app, attempt, id, hash, bytes).status(), 204);
            });
        }
        let app = &app;
        let attempt = &attempt;
        scope.spawn(move || {
            refusal(
                blob(app, attempt, id, &"0".repeat(64), vec![1]),
                404,
                "upload-unknown-blob",
                &attempt.bearer,
            )
        });
        scope.spawn(move || {
            refusal(
                complete(app, attempt, Uuid::now_v7().into()),
                404,
                "not-found",
                &attempt.bearer,
            )
        });
        scope.spawn(move || {
            refusal(
                complete(app, attempt, sibling_id),
                410,
                "upload-expired",
                &attempt.bearer,
            )
        });
    });
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Rejected));
    json(complete(&app, &attempt, id), 201);
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::Accepted));
}
