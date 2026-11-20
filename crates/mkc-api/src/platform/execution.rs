//! Typed command dispatch inside the transaction boundary.

use chrono::{DateTime, Utc};
use mkc_billing::entitlements::Entitlements;
use mkc_domain::ids::UserId;
use mkc_publications::build_eligibility::BuildEligibility;
use mkc_store_interface::store::Queries;
use uuid::Uuid;

use crate::action::Action;
use crate::pagination::Pagination;
use crate::payload::Reply;

use super::error::{Error, Result};
use super::initial_plan::PreviewWorkspacePlan;
pub(super) trait Command {
    fn execute(&self, queries: &mut dyn Queries) -> Result<Reply>;
}

pub(super) struct Execution<'a> {
    pub(super) builds_configured: bool,
    pub(super) actor: Option<UserId>,
    pub(super) action: &'a Action,
    pub(super) page: Pagination,
    pub(super) id: Uuid,
    pub(super) second_id: Uuid,
    pub(super) now: DateTime<Utc>,
    pub(super) entitlements: &'a dyn Entitlements,
    pub(super) preview_workspace: Option<&'a PreviewWorkspacePlan>,
    pub(super) token_secret: Option<String>,
    pub(super) app_origin: &'a str,
    pub(super) canceled_subscription: Option<String>,
}

impl BuildEligibility for Execution<'_> {
    fn configured(&self) -> bool {
        self.builds_configured
    }
}

impl Execution<'_> {
    pub(super) fn actor(&self) -> Result<UserId> {
        self.actor.ok_or(Error::Unauthenticated)
    }
}

impl Command for Execution<'_> {
    fn execute(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::Account(_)
            | Action::Workspaces
            | Action::CreateWorkspace(_)
            | Action::Workspace(_)
            | Action::RenameWorkspace(..)
            | Action::DeleteWorkspace(..) => self.workspaces(queries),
            Action::SuggestWorkspaceSlug(_)
            | Action::WorkspaceBySlug(_)
            | Action::SuggestProjectSlug(..)
            | Action::ProjectBySlug(..) => self.slugs(queries),
            Action::Members(_)
            | Action::Invite(..)
            | Action::UpdateMember(..)
            | Action::RemoveMember(..)
            | Action::Accept(..) => self.members(queries),
            Action::Projects(_)
            | Action::CreateProject(..)
            | Action::Project(_)
            | Action::UpdateProject(..)
            | Action::DeleteProject(..) => self.projects(queries),
            Action::Grants(_)
            | Action::CreateGrant(..)
            | Action::UpdateGrant(..)
            | Action::RemoveGrant(..) => self.grants(queries),
            Action::Tokens(_) | Action::CreateToken(..) | Action::RevokeToken(..) => {
                self.tokens(queries)
            }
        }
    }
}
