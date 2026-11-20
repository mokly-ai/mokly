//! Running API uploads reach GitHub and verified Re-run deliveries retain their identity.

use std::sync::Arc;
use std::sync::atomic::Ordering;

use chrono::Utc;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::publication_event::EventKind;
use serde_json::{Value, json};
use uuid::Uuid;

use super::check_support::{CheckRuntime, wait_until};
use super::fixtures;
use super::harness::Harness;

fn rerequest(app: &Harness, event: &str, publication: PublicationId) {
    let mut body: Value = serde_json::from_slice(&fixtures::delivery(event)).unwrap();
    if event == "check_run" {
        body["check_run"]["external_id"] = json!(format!("mokly-publication:{publication}"));
    }
    let id = Uuid::now_v7();
    let bytes = serde_json::to_vec(&body).unwrap();
    assert_eq!(app.webhook(id, event, bytes.clone(), true).status(), 202);
    app.wait_delivery(id, DeliveryStatus::Done);
    assert_eq!(app.webhook(id, event, bytes, true).status(), 202);
}

#[test]
fn upload_creates_a_live_check_and_both_rerun_events_update_the_same_run() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let publication = app.publish(project.id, "octocat/Hello-World", &"a".repeat(40));
    let first = app.wait_check(publication, 0);
    assert_eq!(first["status"], "completed");
    assert_eq!(first["conclusion"], "success");
    assert!(
        first["output"]["summary"]
            .as_str()
            .unwrap()
            .contains("[View Changes]")
    );
    assert!(
        first["details_url"]
            .as_str()
            .unwrap()
            .contains(&format!("/publications/{publication}?view=changes"))
    );
    wait_until(|| app.check_events_are_delivered(publication));
    app.queries(&mut |queries| {
        let stored = queries.github_check(4).unwrap().unwrap();
        assert_eq!(stored.project_id, project.id);
        assert_eq!(stored.repository_id, project.repository);
        assert_eq!(stored.head_sha, "a".repeat(40));
    });
    for (event, updates) in [("check_run", 1), ("check_suite", 2)] {
        rerequest(&app, event, publication);
        wait_until(|| {
            let mut queued = false;
            app.queries(&mut |queries| {
                let check = queries.github_check(4).unwrap().unwrap();
                let events = queries
                    .pending_publication_events(Utc::now(), 100, Some(project.id))
                    .unwrap();
                queued = !check.rerequested
                    && events.iter().any(|pending| {
                        pending.event.kind == EventKind::Rerequest
                            && pending.event.publication_id == publication
                            && pending.attempts == 0
                            && pending.permanent_failures == 0
                    });
            });
            queued
        });
        let updated = app.wait_check(publication, updates);
        assert_eq!(updated["id"], first["id"]);
        assert_eq!(updated["output"], first["output"]);
        wait_until(|| app.check_events_are_delivered(publication));
    }
    let mode = app.github.mode.lock().unwrap();
    assert_eq!(mode.check_creates, 1);
    assert_eq!(mode.check_lists, 1);
    assert_eq!(mode.check_updates, 2);
    println!(
        "PASS live check smoke: real upload, create, stored identity, check-run and check-suite rerequests, duplicate webhook, same-run updates"
    );
}

#[test]
fn lost_create_response_recovers_by_external_id_before_another_create() {
    let runtime = Arc::new(CheckRuntime::default());
    let Some(mut app) = Harness::start_with_runtime(runtime.clone()) else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    app.github.mode.lock().unwrap().lose_create_response = true;
    let publication = app.publish(project.id, "octocat/Hello-World", &"a".repeat(40));
    wait_until(|| {
        let mut failed = false;
        app.queries(&mut |queries| {
            failed = queries
                .pending_publication_events(
                    Utc::now() + chrono::Duration::minutes(2),
                    100,
                    Some(project.id),
                )
                .unwrap()
                .iter()
                .any(|pending| {
                    pending.event.publication_id == publication
                        && pending.attempts == 1
                        && pending.permanent_failures == 0
                });
            assert!(queries.github_check(4).unwrap().is_none());
        });
        failed
    });
    runtime.offset.store(65, Ordering::SeqCst);
    app.wait_check(publication, 1);
    wait_until(|| app.check_events_are_delivered(publication));
    app.queries(&mut |queries| {
        assert_eq!(
            queries.github_check(4).unwrap().unwrap().external_id,
            format!("mokly-publication:{publication}")
        )
    });
    let mode = app.github.mode.lock().unwrap();
    assert_eq!(mode.check_creates, 1);
    assert_eq!(mode.check_lists, 2);
    assert_eq!(mode.check_updates, 1);
    println!(
        "PASS create recovery: provider keeps the run, response is lost, retry lists and recovers it, one provider create"
    );
}

#[test]
fn unlinked_project_uploads_are_acknowledged_without_provider_requests() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let workspace = app.workspace("Unbound checks");
    let project = app.unlinked_project(
        workspace["id"].as_str().unwrap(),
        "explicit-catalogue",
        "octocat/Hello-World",
    );
    let project = project["id"]
        .as_str()
        .unwrap()
        .parse::<Uuid>()
        .unwrap()
        .into();
    let publication = app.publish(project, "octocat/Hello-World", &"a".repeat(40));
    wait_until(|| app.check_events_are_delivered(publication));
    let mode = app.github.mode.lock().unwrap();
    assert_eq!(
        (mode.check_lists, mode.check_creates, mode.check_updates),
        (0, 0, 0)
    );
    println!("PASS unbound check: real ready upload, delivered event, no GitHub check request");
}
