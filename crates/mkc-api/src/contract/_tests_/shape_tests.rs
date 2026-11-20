//! Structural invariants for flattened resources and conditional request fields.

#![allow(clippy::unwrap_used)]

use mkc_domain::ids::{GrantId, UserId};
use mkc_domain::values::Role;
use serde_json::{Value, json, to_value};
use utoipa::{PartialSchema, ToSchema};
use uuid::Uuid;

use crate::input::CreateProject;
use crate::views::grants::{GrantView, GrantViewFields};
use crate::views::projects::ProjectSlugLookupView;
use crate::views::workspaces::WorkspaceSlugLookupView;

use super::response_validation::document;
use super::support::validator;

#[test]
fn lookup_fields_reference_registered_slug_components() {
    let mut workspace_components = Vec::new();
    WorkspaceSlugLookupView::schemas(&mut workspace_components);
    let mut project_components = Vec::new();
    ProjectSlugLookupView::schemas(&mut project_components);
    for (lookup, schema, components, fields) in [
        (
            "WorkspaceSlugLookup",
            to_value(WorkspaceSlugLookupView::schema()).unwrap(),
            workspace_components,
            vec![("canonicalSlug", "WorkspaceSlug")],
        ),
        (
            "ProjectSlugLookup",
            to_value(ProjectSlugLookupView::schema()).unwrap(),
            project_components,
            vec![
                ("canonicalSlug", "ProjectSlug"),
                ("canonicalWorkspaceSlug", "WorkspaceSlug"),
            ],
        ),
    ] {
        for (field, component) in fields {
            let expected = json!({"$ref": format!("#/components/schemas/{component}")});
            assert_eq!(schema["properties"][field], expected, "{lookup}.{field}");
            assert_eq!(
                document()["components"]["schemas"][lookup]["properties"][field],
                expected,
                "{lookup}.{field} in the complete document"
            );
            let registered = components
                .iter()
                .find(|(name, _)| name == component)
                .unwrap();
            assert_eq!(
                to_value(&registered.1).unwrap(),
                document()["components"]["schemas"][component]
            );
        }
    }
}

#[test]
fn create_project_requires_exactly_one_repository_source() {
    let validator = validator::<CreateProject>();
    let base = json!({"name":"Docs", "slug":"docs", "configPath":"mokly.config.json"});
    assert!(!validator.is_valid(&base));
    assert!(serde_json::from_value::<CreateProject>(base.clone()).is_err());
    let mut installed = base.clone();
    installed["repositoryId"] = json!(Uuid::nil());
    assert!(validator.is_valid(&installed));
    assert!(serde_json::from_value::<CreateProject>(installed.clone()).is_ok());
    let mut cli = base.clone();
    cli["repository"] = json!("gitlab.com/team/docs.git");
    assert!(validator.is_valid(&cli));
    assert!(serde_json::from_value::<CreateProject>(cli.clone()).is_ok());
    cli["kind"] = json!("cli");
    assert!(!validator.is_valid(&cli));
    assert!(serde_json::from_value::<CreateProject>(cli).is_err());
    let mut named = installed.clone();
    named["repository"] = json!("mokly/cloud");
    assert!(!validator.is_valid(&named));
    assert!(serde_json::from_value::<CreateProject>(named).is_err());
    installed["repositoryId"] = Value::Null;
    assert!(!validator.is_valid(&installed));
}

#[test]
fn inherited_grants_have_null_ids_and_no_version() {
    let validator = validator::<GrantView>();
    let inherited = GrantView(GrantViewFields {
        id: None,
        user_id: UserId(Uuid::nil()),
        name: "Member".into(),
        role: Role::Member,
        inherited: true,
        version: None,
    });
    let direct = GrantView(GrantViewFields {
        id: Some(GrantId(Uuid::nil())),
        user_id: UserId(Uuid::nil()),
        name: "Member".into(),
        role: Role::Member,
        inherited: false,
        version: Some(1),
    });
    let mut inherited = to_value(inherited).unwrap();
    let mut direct = to_value(direct).unwrap();
    assert!(validator.is_valid(&inherited));
    assert!(validator.is_valid(&direct));
    inherited["version"] = json!(1);
    assert!(!validator.is_valid(&inherited));
    inherited["version"] = Value::Null;
    assert!(!validator.is_valid(&inherited));
    direct.as_object_mut().unwrap().remove("version");
    assert!(!validator.is_valid(&direct));
    direct["version"] = json!(1);
    direct["id"] = Value::Null;
    assert!(!validator.is_valid(&direct));
}

#[test]
fn lookup_schemas_are_flat_and_closed() {
    let workspace = to_value(WorkspaceSlugLookupView::schema()).unwrap();
    let project = to_value(ProjectSlugLookupView::schema()).unwrap();
    for (schema, fields) in [
        (workspace, vec!["id", "slug", "canonicalSlug"]),
        (
            project,
            vec!["id", "slug", "canonicalSlug", "canonicalWorkspaceSlug"],
        ),
    ] {
        assert_eq!(schema["additionalProperties"], false);
        assert!(schema.get("allOf").is_none());
        for field in fields {
            assert!(schema["properties"].get(field).is_some());
            assert!(
                schema["required"]
                    .as_array()
                    .unwrap()
                    .contains(&json!(field))
            );
        }
    }
}
