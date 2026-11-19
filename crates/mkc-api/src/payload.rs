//! Typed successful responses and bounded list envelopes.

use std::fmt;

use mkc_email_interface::mail::Message;
use serde::Serialize;
use utoipa::ToSchema;

use crate::billing::views::{Billing, HostedSession};
use crate::builds::history::HistoryEntry;
use crate::builds::views::{Build, Log};
use crate::contract::pages::page_items;
use crate::github::views;
use crate::health::HealthView;
use crate::publication_views::AccessGrantView;
use crate::viewer::views::{Branch, Publication, PullRequest, Screen, ShareLink};
use crate::views::account::{
    DesktopGrantView, MagicLinkView, SessionIssuedView, SessionView, UserView,
};
use crate::views::grants::GrantView;
use crate::views::projects::{ProjectSlugLookupView, ProjectSlugSuggestionView, ProjectView};
use crate::views::tokens::{TokenCreated, TokenView};
use crate::views::workspaces::{
    MemberView, WorkspaceSlugLookupView, WorkspaceSlugSuggestionView, WorkspaceView,
};

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Page<T> {
    #[schema(schema_with = page_items::<T>)]
    pub(crate) items: Vec<T>,
    #[schema(required)]
    pub(crate) next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub(crate) enum Payload {
    Billing(Billing),
    BillingSession(HostedSession),
    GitHubConnection(views::Connection),
    GitHubInstallations(Page<views::Installation>),
    GitHubRepositories(Page<views::Repository>),
    Health(HealthView),
    Build(Build),
    BuildLog(Log),
    History(Page<HistoryEntry>),
    Branches(Page<Branch>),
    PullRequests(Page<PullRequest>),
    Publications(Page<Publication>),
    Publication(Publication),
    Screens(Page<Screen>),
    ShareLink(ShareLink),
    CatalogueGrant(AccessGrantView),
    User(UserView),
    Workspace(WorkspaceView),
    WorkspaceSlugLookup(WorkspaceSlugLookupView),
    WorkspaceSlugSuggestion(WorkspaceSlugSuggestionView),
    Workspaces(Page<WorkspaceView>),
    Member(MemberView),
    Members(Page<MemberView>),
    Project(ProjectView),
    ProjectSlugLookup(ProjectSlugLookupView),
    ProjectSlugSuggestion(ProjectSlugSuggestionView),
    Projects(Page<ProjectView>),
    Grant(GrantView),
    Grants(Page<GrantView>),
    Token(TokenCreated),
    Tokens(Page<TokenView>),
    Session(SessionView),
    SessionIssued(SessionIssuedView),
    MagicLink(MagicLinkView),
    DesktopGrant(DesktopGrantView),
    Empty,
}

pub(crate) enum Effect {
    Mail(Message),
}

impl fmt::Debug for Effect {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Mail(_) => formatter.write_str("Mail(<redacted>)"),
        }
    }
}

#[derive(Debug)]
pub(crate) struct Reply {
    pub(crate) status: u16,
    pub(crate) payload: Payload,
    pub(crate) cookie: Option<String>,
    pub(crate) effects: Vec<Effect>,
}

impl Reply {
    pub(crate) fn ok(payload: Payload) -> Self {
        Self {
            status: 200,
            payload,
            cookie: None,
            effects: Vec::new(),
        }
    }
    pub(crate) fn created(payload: Payload) -> Self {
        Self {
            status: 201,
            payload,
            cookie: None,
            effects: Vec::new(),
        }
    }
    pub(crate) fn empty() -> Self {
        Self {
            status: 204,
            payload: Payload::Empty,
            cookie: None,
            effects: Vec::new(),
        }
    }

    pub(crate) fn with_effect(mut self, effect: Effect) -> Self {
        self.effects.push(effect);
        self
    }
}
