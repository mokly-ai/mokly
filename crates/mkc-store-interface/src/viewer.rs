//! Project-scoped viewer queries and complete keyset ordering boundaries.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_domain::pull_request::PullRequestRepositories;
use serde::{Deserialize, Serialize};

use crate::build_history::BuildSummary;
use crate::error::Result;
use crate::publication::{Publication, PublicationState};

/// Last branch in default-first, bytewise-name order.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BranchKey {
    /// Whether this row was the default branch when observed.
    pub is_default: bool,
    /// Branch name, including any slashes.
    pub name: String,
}

/// Union of an observed provider branch and project publication history.
#[derive(Clone, Debug)]
pub struct ViewerBranch {
    /// Complete ordering key and branch identity.
    pub key: BranchKey,
    /// Newest retained ready publication, if any.
    pub latest_publication_id: Option<PublicationId>,
    /// Newest admitted attempt in any lifecycle state; absent without history.
    pub newest_publication: Option<PublicationSummary>,
    /// Newest build in any state; services hide it from readers without member access.
    pub newest_build: Option<BuildSummary>,
    /// Latest provider observation or publication admission.
    pub updated_at: DateTime<Utc>,
}

/// Last PR in open-first, newest-observation-first order.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PullRequestKey {
    /// Whether the observed PR was open.
    pub open: bool,
    /// Server provider-observation time.
    pub updated_at: DateTime<Utc>,
    /// Unique repository-local tie breaker.
    pub number: i64,
}

/// Provider PR metadata with a project-scoped latest publication.
#[derive(Clone, Debug)]
pub struct ViewerPullRequest {
    /// Complete ordering key and PR number.
    pub key: PullRequestKey,
    /// Provider title.
    pub title: String,
    /// Provider author login; absent on observations predating author retention.
    pub author: Option<String>,
    /// Source branch name.
    pub branch: String,
    /// Whether the provider reports a merge.
    pub merged: bool,
    /// Canonical bound repository name, used to build its browser URL.
    pub repository: String,
    /// Stored head and base identities with the project's bound repository ID.
    pub repositories: PullRequestRepositories,
    /// Newest retained ready publication naming this PR number.
    pub latest_publication_id: Option<PublicationId>,
    /// Newest admitted attempt in any lifecycle state; absent without history.
    pub newest_publication: Option<PublicationSummary>,
    /// Newest build in any state; services hide it from readers without member access.
    pub newest_build: Option<BuildSummary>,
}

/// Newest attempt metadata carried on a reference without another history read.
#[derive(Clone, Debug)]
pub struct PublicationSummary {
    /// Cloud build that created this publication, if any.
    pub build_id: Option<BuildId>,
    /// Immutable attempt identifier.
    pub id: PublicationId,
    /// Current lifecycle state, including unfinished, failed and expired attempts.
    pub state: PublicationState,
    /// Server admission time, never a producer or provider timestamp.
    pub created_at: DateTime<Utc>,
    /// Admitted source object ID when available.
    pub head_sha: Option<String>,
}

/// Retained provider details for the PR number admitted with a publication.
#[derive(Clone, Debug)]
pub struct PublicationPullRequest {
    /// Repository-local producer PR number.
    pub number: i64,
    /// Last observed provider title.
    pub title: String,
    /// Provider author login, absent on older observations.
    pub author: Option<String>,
    /// Canonical name of the project's bound repository.
    pub repository: String,
}

/// Publication data enriched for viewer reads without altering ingest records.
#[derive(Clone, Debug)]
pub struct ViewerPublication {
    /// Immutable admitted metadata and current lifecycle state.
    pub publication: Publication,
    /// Observed PR matching the admitted number and bound repository, if any.
    pub pull_request: Option<PublicationPullRequest>,
}

/// Last publication in newest-admission-first order.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PublicationKey {
    /// Server admission time, independent of producer clocks.
    pub created_at: DateTime<Utc>,
    /// Unique tie breaker.
    pub id: PublicationId,
}

/// Optional history predicates, combined by intersection.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HistoryFilter {
    /// Exact producer branch.
    pub branch: Option<String>,
    /// Positive producer PR number.
    pub pull_request: Option<i64>,
}

/// Read queries, called only after the service authorizes the owning project.
#[unimock::unimock(api = ViewerReadsMock)]
pub trait ViewerReads {
    /// Read at most `limit` branches after the complete ordering key.
    fn viewer_branches(
        &mut self,
        project: ProjectId,
        after: Option<&BranchKey>,
        limit: i64,
    ) -> Result<Vec<ViewerBranch>>;
    /// Read at most `limit` PRs after the complete ordering key.
    fn viewer_pull_requests(
        &mut self,
        project: ProjectId,
        after: Option<&PullRequestKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPullRequest>>;
    /// Read lifecycle history, including failed and expired rows.
    fn viewer_publications(
        &mut self,
        project: ProjectId,
        filter: &HistoryFilter,
        after: Option<&PublicationKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPublication>>;
    /// Read one retained publication; foreign and expired rows are absent.
    fn viewer_publication(
        &mut self,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<Option<ViewerPublication>>;
}
