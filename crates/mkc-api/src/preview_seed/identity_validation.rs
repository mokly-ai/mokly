//! Retained seed data must match the requested identity before token creation.

use mkc_domain::ids::OrganizationId;

use crate::views::projects::ProjectSlugLookupView;
use crate::views::workspaces::WorkspaceSlugLookupView;

use super::error::{Result, require};
use super::identity::{
    CONFIG_PATH, PROJECT_NAME, PROJECT_SLUG, REPOSITORY, WORKSPACE_NAME, WORKSPACE_SLUG,
};

pub(super) fn workspace(found: &WorkspaceSlugLookupView) -> Result<()> {
    let workspace = &found.workspace;
    require("workspace name", WORKSPACE_NAME, workspace.name.as_str())?;
    require("workspace slug", WORKSPACE_SLUG, workspace.slug.as_str())?;
    require(
        "workspace canonicalSlug",
        WORKSPACE_SLUG,
        found.canonical_slug.as_str(),
    )?;
    require("workspace plan", "team", workspace.plan.as_str())
}

pub(super) fn project(found: &ProjectSlugLookupView, workspace: OrganizationId) -> Result<()> {
    let project = &found.project;
    require("project workspaceId", workspace, project.workspace_id)?;
    require(
        "project workspaceSlug",
        WORKSPACE_SLUG,
        project.workspace_slug.as_str(),
    )?;
    require(
        "project canonicalWorkspaceSlug",
        WORKSPACE_SLUG,
        found.canonical_workspace_slug.as_str(),
    )?;
    require("project name", PROJECT_NAME, project.name.as_str())?;
    require("project slug", PROJECT_SLUG, project.slug.as_str())?;
    require(
        "project canonicalSlug",
        PROJECT_SLUG,
        found.canonical_slug.as_str(),
    )?;
    require(
        "project repository",
        REPOSITORY,
        project.repository.as_str(),
    )?;
    require(
        "project configPath",
        CONFIG_PATH,
        project.config_path.as_str(),
    )?;
    require("project visibility", "private", project.visibility.as_str())?;
    require("project automaticBuilds", false, project.automatic_builds)?;
    require("project buildsAvailable", false, project.builds_available)
}
