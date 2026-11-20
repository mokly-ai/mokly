//! Serialized nulls remain required and descriptions do not change field types.

#![allow(clippy::unwrap_used)]

use chrono::{TimeZone, Utc};
use mkc_domain::ids::{OrganizationId, ProjectId, PublicationId};
use mkc_domain::values::{Plan, Role};
use serde_json::{json, to_value};
use utoipa::OpenApi;
use uuid::Uuid;

use crate::contract::document::ApiDoc;
use crate::payload::Page;
use crate::viewer::publication_state::PublicationStateView;
use crate::viewer::views::{Changes, ChangesState, Publication};
use crate::views::workspaces::{InstallationState, WorkspaceView};

use super::support::validator;

#[test]
fn workspace_page_keeps_serialized_next_cursor_null_required() {
    let workspace = WorkspaceView {
        id: OrganizationId(Uuid::nil()),
        name: "Mokly".into(),
        slug: "mokly".parse().unwrap(),
        role: Role::Owner,
        plan: Plan::Free,
        github_installation_state: InstallationState::Absent,
        version: 1,
    };
    let value = to_value(Page {
        items: vec![workspace],
        next_cursor: None,
    })
    .unwrap();
    let components = to_value(ApiDoc::openapi().components.unwrap()).unwrap();
    let mut schema = components["schemas"].get("Page_Workspace").unwrap().clone();
    schema["components"] = components;
    let validator = jsonschema::validator_for(&schema).unwrap();
    assert!(validator.is_valid(&value), "{value}");
    assert_eq!(value["nextCursor"], json!(null));
    let mut absent = value.clone();
    absent.as_object_mut().unwrap().remove("nextCursor");
    assert!(!validator.is_valid(&absent));
    let mut unknown = value;
    unknown["items"][0]["extra"] = json!(true);
    assert!(!validator.is_valid(&unknown));
}

#[test]
fn publication_nullable_fields_accept_null_and_reject_omission() {
    let publication = Publication {
        id: PublicationId(Uuid::nil()),
        project_id: ProjectId(Uuid::nil()),
        build_id: None,
        branch: None,
        head_sha: None,
        published_at: Utc.timestamp_opt(0, 0).unwrap(),
        state: PublicationStateView::Uploading,
        failure_code: None,
        catalogue_url: None,
        review_id: None,
        changes: Changes {
            state: ChangesState::Unavailable,
            added: None,
            changed: None,
            removed: None,
        },
        can_comment: false,
        pull_request: None,
    };
    let value = to_value(publication).unwrap();
    let validator = validator::<Publication>();
    assert!(validator.is_valid(&value), "{value}");
    for name in [
        "buildId",
        "branch",
        "headSha",
        "failureCode",
        "catalogueUrl",
        "reviewId",
        "pullRequest",
    ] {
        let mut absent = value.clone();
        absent.as_object_mut().unwrap().remove(name);
        assert!(!validator.is_valid(&absent), "{name}");
    }
}
