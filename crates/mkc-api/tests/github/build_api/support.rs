//! Real query fixtures shared by build API scenarios.

use chrono::{DateTime, Duration, Utc};
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_domain::values::{Role, Visibility};
use mkc_store_interface::build::{Build, NewBuild};
use mkc_store_interface::build_attempt::{BuildAttempt, BuildFinish};
use mkc_store_interface::build_state::{BuildFailure, BuildState, BuildTrigger};
use mkc_store_interface::grant::Grant;
use mkc_store_interface::member::Member;
use mkc_store_interface::publication::{Publication, PublicationMetadata, PublicationState};
use mkc_store_interface::publication_changes::Changes;
use reqwest::Method;
use serde_json::Value;
use uuid::Uuid;

use crate::contract_client::ContractResponse;

use super::super::harness::{Harness, json};
use super::super::workflow::Project;

pub(super) fn read(app: &Harness, project: ProjectId, tail: &str) -> Value {
    let path = if tail.is_empty() {
        format!("/v1/projects/{project}")
    } else {
        format!("/v1/projects/{project}/{tail}")
    };
    let response = app.request(Method::GET, &path).send().unwrap();
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert!(response.headers().contains_key("x-request-id"));
    json(response, 200)
}

pub(super) fn refusal(response: ContractResponse, status: u16, reason: &str) -> Value {
    assert_eq!(response.headers()["cache-control"], "no-store");
    let id = response.headers()["x-request-id"]
        .to_str()
        .unwrap()
        .to_owned();
    let value = json(response, status);
    assert_eq!(value["error"]["reason"], reason);
    assert_eq!(value["error"]["request_id"], id);
    value
}

pub(super) fn visibility(app: &Harness, project: ProjectId, visibility: Visibility) {
    app.queries(&mut |q| {
        let mut value = q.project(project).unwrap().unwrap();
        value.visibility = visibility;
        q.save_project(&value).unwrap();
    });
}

pub(super) fn role(app: &Harness, project: ProjectId, role: Option<Role>, direct: bool) {
    app.queries(&mut |q| {
        let workspace = q.project(project).unwrap().unwrap().organization_id;
        for member in q.members(workspace).unwrap() {
            if member.user_id == Some(app.user) {
                q.delete_member(member.id).unwrap();
            }
        }
        for grant in q.grants(project).unwrap() {
            if grant.user_id == app.user {
                q.delete_grant(grant.id).unwrap();
            }
        }
        if let Some(role) = role {
            if direct {
                q.insert_grant(&Grant {
                    id: Uuid::now_v7().into(),
                    project_id: project,
                    user_id: app.user,
                    role,
                    version: 1,
                })
                .unwrap();
            } else {
                q.insert_member(&Member {
                    id: Uuid::now_v7().into(),
                    organization_id: workspace,
                    user_id: Some(app.user),
                    email: "octocat@example.com".into(),
                    role,
                    version: 1,
                    expires_at: None,
                })
                .unwrap();
            }
        }
    });
}

pub(super) fn schedule(
    app: &Harness,
    project: &Project,
    branch: &str,
    index: u32,
    pull: Option<i64>,
    at: DateTime<Utc>,
) -> BuildId {
    let id = Uuid::now_v7().into();
    app.queries(&mut |q| {
        q.schedule_build(&NewBuild {
            id,
            project_id: project.id,
            repository_id: project.repository,
            trigger: BuildTrigger::Request,
            branch: branch.into(),
            head_sha: format!("{index:040x}"),
            pull_request: pull,
            base_ref: None,
            config_path: "mokly.config.json".into(),
            created_at: at,
        })
        .unwrap();
    });
    id
}

pub(super) fn build(app: &Harness, project: ProjectId, id: BuildId) -> Build {
    let mut value = None;
    app.queries(&mut |q| {
        value = q.build(project, id).unwrap();
    });
    value.unwrap()
}

pub(super) fn start(app: &Harness, project: ProjectId, id: BuildId) -> Build {
    let at = Utc::now();
    app.queries(&mut |q| {
        q.start_build(
            id,
            &BuildAttempt {
                now: at,
                operation_id: Uuid::now_v7(),
                lease_token: Uuid::now_v7(),
                lease_expires_at: at + Duration::minutes(2),
                deadline_at: at + Duration::minutes(15),
            },
        )
        .unwrap()
        .unwrap();
    });
    build(app, project, id)
}

pub(super) fn finish(app: &Harness, project: ProjectId, id: BuildId, state: BuildState) {
    let value = build(app, project, id);
    let value = if value.state == BuildState::Queued && state != BuildState::Failed {
        start(app, project, id)
    } else {
        value
    };
    let at = Utc::now();
    let cause = match state {
        BuildState::Failed => Some(BuildFailure::Exit),
        BuildState::TimedOut => Some(BuildFailure::Deadline),
        _ => None,
    };
    app.queries(&mut |q| {
        assert!(
            q.finish_build(
                id,
                value.lease_token,
                &BuildFinish {
                    state,
                    failure_cause: cause,
                    exit_code: None,
                    at,
                    next_attempt_at: at
                }
            )
            .unwrap()
        );
    });
}

pub(super) fn publication(
    project: ProjectId,
    branch: &str,
    index: u32,
    at: DateTime<Utc>,
) -> Publication {
    Publication {
        id: Uuid::now_v7().into(),
        project_id: project,
        build_id: None,
        build_failure_event_id: None,
        metadata: Some(PublicationMetadata {
            branch: branch.into(),
            head_sha: format!("{index:040x}"),
            base_ref: None,
            base_sha: None,
            pull_request: None,
            config_path: "mokly.config.json".into(),
            exported_at: at,
        }),
        state: PublicationState::Ready,
        failure: None,
        changes: Some(Changes::NoComparison),
        created_at: at,
        deadline: at + Duration::hours(1),
        expired_at: None,
    }
}
