//! Every upload route reads live grant ownership before it accepts request bytes.

use chrono::{Duration, Utc};
use mkc_store_interface::build_attempt::{BuildAttempt, BuildFinish};
use mkc_store_interface::build_state::{BuildState, UploadOutcome};
use uuid::Uuid;

use super::super::harness::Harness;
use super::support::{Attempt, blob, complete, outcome, plan, refusal, start};

fn all_routes(app: &Harness, attempt: &Attempt, status: u16, reason: &str) {
    let id = Uuid::now_v7().into();
    refusal(
        plan(app, attempt, b"not an archive".to_vec()),
        status,
        reason,
        &attempt.bearer,
    );
    refusal(
        blob(app, attempt, id, &"a".repeat(64), vec![1]),
        status,
        reason,
        &attempt.bearer,
    );
    refusal(complete(app, attempt, id), status, reason, &attempt.bearer);
}

#[test]
fn unknown_expired_cancelled_and_stale_grants_fail_on_all_three_requests() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    for case in 0..6 {
        let age = match case {
            1 => Duration::minutes(16),
            2 => Duration::minutes(3),
            _ => Duration::zero(),
        };
        let mut attempt = start(&app, &project, case, age, None);
        if case == 0 {
            attempt.bearer = format!("mkb_{}", "0".repeat(64));
        } else if case == 3 {
            app.queries(&mut |queries| {
                queries.cancel_build(project.id, attempt.id, Utc::now())?;
                Ok(())
            });
        } else if case == 4 || case == 5 {
            app.queries(&mut |queries| {
                let current = queries.build(project.id, attempt.id)?.unwrap();
                assert!(queries.finish_build(
                    attempt.id,
                    current.lease_token,
                    &BuildFinish {
                        state: if case == 4 {
                            BuildState::Superseded
                        } else {
                            BuildState::Queued
                        },
                        failure_cause: None,
                        exit_code: None,
                        at: Utc::now(),
                        next_attempt_at: Utc::now(),
                    }
                )?);
                if case == 5 {
                    let now = Utc::now();
                    queries
                        .start_build(
                            attempt.id,
                            &BuildAttempt {
                                now,
                                operation_id: Uuid::now_v7(),
                                lease_token: Uuid::now_v7(),
                                lease_expires_at: now + Duration::minutes(2),
                                deadline_at: now + Duration::minutes(15),
                            },
                        )?
                        .unwrap();
                }
                Ok(())
            });
        }
        all_routes(&app, &attempt, 401, "upload-unauthorized");
        app.queries(&mut |queries| {
            queries.cancel_build(project.id, attempt.id, Utc::now())?;
            Ok(())
        });
    }
}

#[test]
fn project_scope_and_the_current_plan_gate_every_route() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let mut attempt = start(&app, &project, 20, Duration::zero(), None);
    attempt.project = Uuid::now_v7().into();
    all_routes(&app, &attempt, 403, "upload-forbidden");
    attempt.project = project.id;
    assert_eq!(outcome(&app, &attempt), None);
    app.queries(&mut |queries| {
        let mut value = queries.project(project.id)?.unwrap();
        value.visibility = mkc_domain::values::Visibility::Private;
        queries.save_project(&value)?;
        Ok(())
    });
    all_routes(&app, &attempt, 403, "upload-plan-required");
    assert_eq!(outcome(&app, &attempt), Some(UploadOutcome::PlanRequired));
}
