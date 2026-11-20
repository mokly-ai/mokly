//! Cancellation state, idempotency and committed-upload races use database fences.

use std::sync::{Arc, Barrier};
use std::thread;

use chrono::Utc;
use mkc_domain::values::Role;
use mkc_store_interface::build_grant::BuildUploadGrant;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::store::Callback;
use reqwest::Method;

use super::super::harness::{Harness, json};
use super::support::{build, finish, publication, read, refusal, role, schedule, start};

#[test]
fn cancel_handles_every_state_and_returns_committed_and_terminal_builds_unchanged() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for (index, state) in [
        BuildState::Queued,
        BuildState::Running,
        BuildState::Failed,
        BuildState::TimedOut,
        BuildState::Cancelled,
        BuildState::Superseded,
        BuildState::Published,
    ]
    .into_iter()
    .enumerate()
    {
        let id = schedule(
            &app,
            &project,
            &format!("state-{index}"),
            index as u32,
            None,
            Utc::now(),
        );
        if state == BuildState::Running || state == BuildState::Published {
            start(&app, project.id, id);
        }
        if state == BuildState::Published {
            let running = build(&app, project.id, id);
            let ready = publication(project.id, &running.branch, index as u32, Utc::now());
            let grant = BuildUploadGrant {
                id: uuid::Uuid::now_v7(),
                build_id: id,
                attempt: 1,
                token_digest: [index as u8; 32],
                expires_at: running.deadline_at.unwrap(),
                consumed_at: None,
                outcome: None,
                created_at: Utc::now(),
            };
            app.queries(&mut |q| {
                q.insert_publication(&ready).unwrap();
                q.mint_build_grant(&grant).unwrap();
                assert!(
                    q.consume_build_grant(grant.id, ready.id, &|| Utc::now())
                        .unwrap()
                );
            });
            let committed = json(
                app.request(
                    Method::POST,
                    &format!("/v1/projects/{}/builds/{id}/cancel", project.id),
                )
                .send()
                .unwrap(),
                200,
            );
            assert_eq!(committed["state"], "running");
            assert_eq!(committed["canCancel"], false);
            finish(&app, project.id, id, state);
        } else if !matches!(state, BuildState::Queued | BuildState::Running) {
            finish(&app, project.id, id, state);
        }
        let expected = if matches!(state, BuildState::Queued | BuildState::Running) {
            "cancelled"
        } else {
            state.as_str()
        };
        for _ in 0..2 {
            let response = json(
                app.request(
                    Method::POST,
                    &format!("/v1/projects/{}/builds/{id}/cancel", project.id),
                )
                .send()
                .unwrap(),
                200,
            );
            assert_eq!(response["state"], expected);
            assert_eq!(response["canCancel"], false);
        }
    }
    let id = schedule(&app, &project, "reviewer", 99, None, Utc::now());
    for direct in [false, true] {
        role(&app, project.id, Some(Role::Reviewer), direct);
        refusal(
            app.request(
                Method::POST,
                &format!("/v1/projects/{}/builds/{id}/cancel", project.id),
            )
            .send()
            .unwrap(),
            403,
            "permission-denied",
        );
        assert_eq!(
            read(&app, project.id, &format!("builds/{id}"))["state"],
            "queued"
        );
    }
}

#[test]
fn cancel_and_ready_commit_serialize_so_only_one_can_win() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let id = schedule(&app, &project, "race", 1, None, Utc::now());
    let running = start(&app, project.id, id);
    let ready = publication(project.id, "race", 1, Utc::now());
    let grant = BuildUploadGrant {
        id: uuid::Uuid::now_v7(),
        build_id: id,
        attempt: 1,
        token_digest: [1; 32],
        expires_at: running.deadline_at.unwrap(),
        consumed_at: None,
        outcome: None,
        created_at: Utc::now(),
    };
    app.queries(&mut |q| {
        q.insert_publication(&ready).unwrap();
        q.mint_build_grant(&grant).unwrap();
    });
    let barrier = Arc::new(Barrier::new(2));
    let store = app.store.clone();
    let other = barrier.clone();
    let commit = thread::spawn(move || {
        other.wait();
        let mut consumed = false;
        store
            .transaction(&mut Callback(&mut |q| {
                consumed = q.consume_build_grant(grant.id, ready.id, &|| Utc::now())?;
                Ok(())
            }))
            .unwrap();
        consumed
    });
    barrier.wait();
    let cancelled = json(
        app.request(
            Method::POST,
            &format!("/v1/projects/{}/builds/{id}/cancel", project.id),
        )
        .send()
        .unwrap(),
        200,
    );
    let committed = commit.join().unwrap();
    let value = build(&app, project.id, id);
    assert_eq!(committed, value.publication_id.is_some());
    assert_eq!(cancelled["state"] == "cancelled", !committed);
    assert_eq!(value.state == BuildState::Cancelled, !committed);
}
