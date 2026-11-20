//! Available slug suggestions derived without exposing incumbent identities.

use mkc_domain::ids::OrganizationId;
use mkc_domain::repository::RepositoryIdentity;
use mkc_domain::slug::{
    PROJECT_SLUG_MAX_LENGTH, ProjectSlug, WORKSPACE_SLUG_MAX_LENGTH, WorkspaceSlug, is_reserved,
    slugify, with_numeric_suffix,
};
use mkc_domain::validation;
use mkc_publications::build_eligibility::BuildEligibility;
use mkc_store_interface::store::Queries;

use crate::action::Action;
use crate::input::{SuggestProjectSlug, SuggestWorkspaceSlug};
use crate::payload::{Payload, Reply};
use crate::views::projects::ProjectSlugSuggestionView;
use crate::views::workspaces::WorkspaceSlugSuggestionView;

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::projection;

impl Execution<'_> {
    pub(super) fn slugs(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::SuggestWorkspaceSlug(input) => {
                let actor = self.actor()?;
                queries
                    .user(actor)
                    .context("user query")?
                    .ok_or(Error::Unauthenticated)?;
                Ok(Reply::ok(Payload::WorkspaceSlugSuggestion(
                    WorkspaceSlugSuggestionView {
                        slug: self.workspace_slug_suggestion(queries, input)?,
                    },
                )))
            }
            Action::WorkspaceBySlug(slug) => {
                let lookup = queries
                    .find_organization_by_slug(slug)
                    .context("workspace slug query")?
                    .ok_or(Error::NotFound)?;
                let workspace_id = lookup.value.id;
                let role = self.workspace_role(queries, workspace_id)?;
                let workspace = projection::workspace(
                    lookup.value,
                    role,
                    queries
                        .github_installations(workspace_id)
                        .context("read workspace installation bindings")?,
                );
                Ok(Reply::ok(Payload::WorkspaceSlugLookup(
                    projection::workspace_slug_lookup(workspace),
                )))
            }
            Action::SuggestProjectSlug(workspace, input) => {
                let role = self.workspace_role(queries, *workspace)?;
                if role < mkc_domain::values::Role::Member {
                    return Err(Error::Forbidden);
                }
                Ok(Reply::ok(Payload::ProjectSlugSuggestion(
                    ProjectSlugSuggestionView {
                        slug: self.project_slug_suggestion(queries, *workspace, input)?,
                    },
                )))
            }
            Action::ProjectBySlug(workspace_slug, project_slug) => {
                let workspace = queries
                    .find_organization_by_slug(workspace_slug)
                    .context("workspace slug query")?
                    .ok_or(Error::NotFound)?
                    .value;
                let lookup = queries
                    .find_project_by_slug(workspace.id, project_slug)
                    .context("project slug query")?
                    .ok_or(Error::NotFound)?;
                let (project, role) = self.project_access(queries, lookup.value.id)?;
                let available = self
                    .access(queries, project.id)
                    .context("slug project build availability")?
                    .is_some();
                let view = projection::project(project, &workspace, role, available);
                Ok(Reply::ok(Payload::ProjectSlugLookup(
                    projection::project_slug_lookup(view),
                )))
            }
            _ => Err(Error::OperationUnavailable),
        }
    }

    pub(super) fn workspace_slug_suggestion(
        &self,
        queries: &mut dyn Queries,
        input: &SuggestWorkspaceSlug,
    ) -> Result<WorkspaceSlug> {
        let name = validation::name(&input.name).ok_or(Error::InvalidInput)?;
        let base = fallback(slugify(&name, WORKSPACE_SLUG_MAX_LENGTH), "workspace");
        self.available_workspace_slug(queries, &base, 1)
    }

    pub(super) fn workspace_slug_recovery(
        &self,
        queries: &mut dyn Queries,
        slug: &WorkspaceSlug,
    ) -> Result<WorkspaceSlug> {
        self.available_workspace_slug(queries, slug.as_str(), 2)
    }

    pub(super) fn project_slug_suggestion(
        &self,
        queries: &mut dyn Queries,
        workspace: OrganizationId,
        input: &SuggestProjectSlug,
    ) -> Result<ProjectSlug> {
        let identity = RepositoryIdentity::parse(&input.repository).ok_or(Error::InvalidInput)?;
        if !validation::config_path(&input.config_path) {
            return Err(Error::InvalidInput);
        }
        let canonical = identity.canonical();
        let repository = canonical
            .rsplit_once('/')
            .map(|(_, name)| name)
            .ok_or(Error::InvalidInput)?;
        let base = fallback(slugify(repository, PROJECT_SLUG_MAX_LENGTH), "project");
        if let Ok(slug) = base.parse::<ProjectSlug>()
            && !queries
                .project_slug_claimed(workspace, &slug)
                .context("check suggested project slug")?
        {
            return Ok(slug);
        }
        let file = input
            .config_path
            .rsplit('/')
            .next()
            .and_then(|value| value.strip_suffix(".json"))
            .ok_or(Error::InvalidInput)?;
        let stem = fallback(slugify(file, PROJECT_SLUG_MAX_LENGTH), "config");
        let compound = slugify(&format!("{base}-{stem}"), PROJECT_SLUG_MAX_LENGTH);
        if let Ok(slug) = compound.parse::<ProjectSlug>()
            && !queries
                .project_slug_claimed(workspace, &slug)
                .context("check compound project slug")?
        {
            return Ok(slug);
        }
        self.available_project_slug(queries, workspace, &compound, 2)
    }

    pub(super) fn project_slug_recovery(
        &self,
        queries: &mut dyn Queries,
        workspace: OrganizationId,
        slug: &ProjectSlug,
    ) -> Result<ProjectSlug> {
        self.available_project_slug(queries, workspace, slug.as_str(), 2)
    }

    fn available_workspace_slug(
        &self,
        queries: &mut dyn Queries,
        base: &str,
        first: u64,
    ) -> Result<WorkspaceSlug> {
        let mut number = first;
        loop {
            let value = candidate(base, number, WORKSPACE_SLUG_MAX_LENGTH);
            if let Ok(slug) = value.parse::<WorkspaceSlug>()
                && !is_reserved(slug.as_str())
                && !queries
                    .organization_slug_claimed(&slug)
                    .context("check suggested workspace slug")?
            {
                return Ok(slug);
            }
            number = increment(number)?;
        }
    }

    fn available_project_slug(
        &self,
        queries: &mut dyn Queries,
        workspace: OrganizationId,
        base: &str,
        first: u64,
    ) -> Result<ProjectSlug> {
        let mut number = first;
        loop {
            let value = candidate(base, number, PROJECT_SLUG_MAX_LENGTH);
            if let Ok(slug) = value.parse::<ProjectSlug>()
                && !queries
                    .project_slug_claimed(workspace, &slug)
                    .context("check suggested project slug")?
            {
                return Ok(slug);
            }
            number = increment(number)?;
        }
    }
}

fn fallback(value: String, fallback: &str) -> String {
    if value.is_empty() {
        fallback.to_owned()
    } else {
        value
    }
}

fn candidate(base: &str, number: u64, max_length: usize) -> String {
    if number == 1 {
        base.to_owned()
    } else {
        with_numeric_suffix(base, number, max_length)
    }
}

fn increment(number: u64) -> Result<u64> {
    number
        .checked_add(1)
        .ok_or_else(|| Error::internal_message("slug suggestion space exhausted"))
}
