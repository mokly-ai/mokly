//! Flatten lookup fields into closed resource schemas instead of closed allOf branches.

use std::borrow::Cow;

use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use utoipa::openapi::{Ref, RefOr, Schema};
use utoipa::{PartialSchema, ToSchema};

use super::projects::{ProjectSlugLookupView, ProjectView};
use super::workspaces::{WorkspaceSlugLookupView, WorkspaceView};

impl PartialSchema for WorkspaceSlugLookupView {
    fn schema() -> RefOr<Schema> {
        let mut schema = WorkspaceView::schema();
        if let RefOr::T(Schema::Object(object)) = &mut schema {
            object.properties.insert(
                "canonicalSlug".into(),
                Ref::from_schema_name(WorkspaceSlug::name()).into(),
            );
            object.required.push("canonicalSlug".into());
        }
        schema
    }
}

impl ToSchema for WorkspaceSlugLookupView {
    fn name() -> Cow<'static, str> {
        Cow::Borrowed("WorkspaceSlugLookup")
    }

    fn schemas(schemas: &mut Vec<(String, RefOr<Schema>)>) {
        WorkspaceView::schemas(schemas);
        schemas.push((WorkspaceSlug::name().into_owned(), WorkspaceSlug::schema()));
        WorkspaceSlug::schemas(schemas);
    }
}

impl PartialSchema for ProjectSlugLookupView {
    fn schema() -> RefOr<Schema> {
        let mut schema = ProjectView::schema();
        if let RefOr::T(Schema::Object(object)) = &mut schema {
            object.properties.insert(
                "canonicalSlug".into(),
                Ref::from_schema_name(ProjectSlug::name()).into(),
            );
            object.properties.insert(
                "canonicalWorkspaceSlug".into(),
                Ref::from_schema_name(WorkspaceSlug::name()).into(),
            );
            object
                .required
                .extend(["canonicalSlug".into(), "canonicalWorkspaceSlug".into()]);
        }
        schema
    }
}

impl ToSchema for ProjectSlugLookupView {
    fn name() -> Cow<'static, str> {
        Cow::Borrowed("ProjectSlugLookup")
    }

    fn schemas(schemas: &mut Vec<(String, RefOr<Schema>)>) {
        ProjectView::schemas(schemas);
        schemas.push((ProjectSlug::name().into_owned(), ProjectSlug::schema()));
        ProjectSlug::schemas(schemas);
        schemas.push((WorkspaceSlug::name().into_owned(), WorkspaceSlug::schema()));
        WorkspaceSlug::schemas(schemas);
    }
}
