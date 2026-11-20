//! One SQL union preserves filtering, exclusions and keyset order for both kinds.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::values::Visibility;
use mkc_store_interface::build_state::BuildState;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use reqwest::Method;
use serde_json::{Value, json};

use uuid::Uuid;

use super::super::harness::Harness;
use super::support::{finish, publication, read, refusal, schedule, visibility};

fn id(entry: &Value) -> &str {
    entry[entry["kind"].as_str().unwrap()]["id"]
        .as_str()
        .unwrap()
}

#[test]
fn mixed_history_pages_ties_and_filters_and_omits_own_failed_uploads_for_every_reader() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let at = DateTime::from_timestamp(Utc::now().timestamp(), 0).unwrap();
    let old = publication(project.id, "topic", 1, at - Duration::seconds(2));
    let failed = schedule(&app, &project, "topic", 2, None, at - Duration::seconds(1));
    finish(&app, project.id, failed, BuildState::Failed);
    let mut newest = publication(project.id, "topic", 3, at);
    newest.metadata.as_mut().unwrap().pull_request = Some(42);
    let queued = schedule(&app, &project, "topic", 4, Some(42), at);
    let cancelled = schedule(&app, &project, "cancelled", 5, None, at);
    finish(&app, project.id, cancelled, BuildState::Cancelled);
    let timed = schedule(&app, &project, "timed", 6, None, at);
    finish(&app, project.id, timed, BuildState::TimedOut);
    app.queries(&mut |q| {
        q.insert_publication(&old).unwrap();
        q.insert_publication(&newest).unwrap();
        for state in [PublicationState::Uploading, PublicationState::Failed] {
            let mut upload = publication(project.id, "topic", 8, at + Duration::seconds(1));
            upload.build_id = Some(failed);
            upload.build_failure_event_id = Some(Uuid::now_v7());
            upload.state = state;
            upload.changes = None;
            upload.failure =
                (state == PublicationState::Failed).then_some(PublicationFailure::InvalidBundle);
            q.insert_publication(&upload).unwrap();
        }
    });
    let first = read(&app, project.id, "history?branch=topic&limit=1");
    assert_eq!(first["items"][0]["kind"], "build");
    assert_eq!(id(&first["items"][0]), queued.to_string());
    let cursor = first["nextCursor"].as_str().unwrap();
    let mut collected = first["items"].as_array().unwrap().clone();
    let mut current = first.clone();
    while let Some(cursor) = current["nextCursor"].as_str() {
        current = read(
            &app,
            project.id,
            &format!("history?branch=topic&limit=1&cursor={cursor}"),
        );
        collected.extend(current["items"].as_array().unwrap().clone());
    }
    assert_eq!(
        collected.iter().map(id).collect::<Vec<_>>(),
        vec![
            queued.to_string(),
            newest.id.to_string(),
            failed.to_string(),
            old.id.to_string()
        ]
    );
    assert_eq!(
        read(&app, project.id, "history?branch=topic&pullRequest=42")["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        read(&app, project.id, "history?branch=missing&pullRequest=42")["items"],
        json!([])
    );
    assert_eq!(
        read(&app, project.id, "publications?branch=topic")["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    let branch = read(&app, project.id, "branches")["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["name"] == "topic")
        .unwrap()
        .clone();
    assert_eq!(branch["newestBuild"]["id"], queued.to_string());
    assert_eq!(branch["newestPublication"]["id"], newest.id.to_string());
    for query in [
        format!("publications?branch=topic&cursor={cursor}"),
        format!("history?branch=other&cursor={cursor}"),
        "history?cursor=invalid".into(),
        "history?limit=0".into(),
        "history?limit=101".into(),
        "history?branch=".into(),
        "history?pullRequest=-1".into(),
        "history?limit=1&limit=1".into(),
        "history?unknown=1".into(),
    ] {
        refusal(
            app.request(Method::GET, &format!("/v1/projects/{}/{query}", project.id))
                .send()
                .unwrap(),
            400,
            "validation-failed",
        );
    }
    visibility(&app, project.id, Visibility::Public);
    app.cookie.clear();
    let public = read(&app, project.id, "history?branch=topic&limit=1");
    assert_eq!(id(&public["items"][0]), newest.id.to_string());
    let next = read(
        &app,
        project.id,
        &format!(
            "history?branch=topic&limit=1&cursor={}",
            public["nextCursor"].as_str().unwrap()
        ),
    );
    assert_eq!(id(&next["items"][0]), old.id.to_string());
    assert!(next["nextCursor"].is_null());
}

#[test]
fn history_cursor_rejects_another_project_and_does_not_need_its_anchor_row() {
    let Some(mut app) = Harness::start() else {
        return;
    };
    app.sign_in();
    let project = app.install_project();
    let at = Utc::now() - Duration::seconds(2);
    let older = publication(project.id, "topic", 1, at);
    let newer = schedule(&app, &project, "topic", 2, None, at + Duration::seconds(1));
    finish(&app, project.id, newer, BuildState::Failed);
    app.queries(&mut |q| {
        q.insert_publication(&older).unwrap();
    });
    let first = read(&app, project.id, "history?limit=1");
    let cursor = first["nextCursor"].as_str().unwrap();
    let workspace = app.workspace("Cursor other");
    let other = app.seeded_project(workspace["id"].as_str().unwrap(), "other", "other/repo");
    refusal(
        app.request(
            Method::GET,
            &format!(
                "/v1/projects/{}/history?limit=1&cursor={cursor}",
                other["id"].as_str().unwrap()
            ),
        )
        .send()
        .unwrap(),
        400,
        "validation-failed",
    );
    app.queries(&mut |q| {
        q.prune_builds(Utc::now() + Duration::seconds(1), 100)
            .unwrap();
    });
    assert_eq!(
        id(&read(
            &app,
            project.id,
            &format!("history?limit=1&cursor={cursor}")
        )["items"][0]),
        older.id.to_string()
    );
}
