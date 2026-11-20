//! Pull request, review and review-comment provider operations.

use serde::{Deserialize, Serialize};

use crate::error::Result;

/// Open/closed GitHub pull request state; merged is a separate property.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum State {
    /// Accepts further updates.
    Open,
    /// Closed, with or without a merge.
    Closed,
}

/// Branch and commit at one side of a pull request.
#[derive(Clone, Debug, Deserialize)]
pub struct Ref {
    /// Branch name.
    #[serde(rename = "ref")]
    pub name: String,
    /// Full commit SHA.
    pub sha: String,
    /// Repository at this side; null when GitHub no longer has the repository.
    pub repo: Option<RefRepository>,
}

/// Stable repository identity used to enforce the cloud build fork rule.
#[derive(Clone, Debug, Deserialize)]
pub struct RefRepository {
    /// Provider repository ID, independent of a rename.
    pub id: i64,
}

/// Current pull request metadata used for publication association.
#[derive(Clone, Debug, Deserialize)]
#[serde(from = "PullRequestResponse")]
pub struct PullRequest {
    /// Repository-local PR number.
    pub number: i64,
    /// User-authored title.
    pub title: String,
    /// Provider author login, absent when the provider omits its user object.
    pub author: Option<String>,
    /// Current lifecycle.
    pub state: State,
    /// Whether the closed pull request was merged.
    pub merged: bool,
    /// Source branch and SHA.
    pub head: Ref,
    /// Destination branch and SHA.
    pub base: Ref,
}

/// GitHub list responses carry merged_at instead of the detail endpoint's merged flag.
#[derive(Deserialize)]
struct PullRequestResponse {
    number: i64,
    title: String,
    user: Option<Author>,
    state: State,
    merged: Option<bool>,
    merged_at: Option<String>,
    head: Ref,
    base: Ref,
}

#[derive(Deserialize)]
struct Author {
    login: String,
}

impl From<PullRequestResponse> for PullRequest {
    fn from(value: PullRequestResponse) -> Self {
        Self {
            number: value.number,
            title: value.title,
            author: value.user.map(|user| user.login),
            state: value.state,
            merged: value.merged.unwrap_or(value.merged_at.is_some()),
            head: value.head,
            base: value.base,
        }
    }
}

/// Review event sent to GitHub.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReviewEvent {
    /// Approve the reviewed commit.
    Approve,
    /// Request changes.
    RequestChanges,
    /// Leave feedback without approval semantics.
    Comment,
}

/// Review pinned to a specific commit.
#[derive(Clone, Debug, Serialize)]
pub struct Review {
    /// Reviewed commit SHA.
    pub commit_id: String,
    /// Markdown feedback.
    pub body: String,
    /// Review outcome.
    pub event: ReviewEvent,
}

/// Right-side line comment on a specific pull request commit.
#[derive(Clone, Debug, Serialize)]
pub struct Comment {
    /// Markdown comment body.
    pub body: String,
    /// Reviewed commit SHA.
    pub commit_id: String,
    /// Repository-relative changed file.
    pub path: String,
    /// Positive line number on the selected side.
    pub line: u32,
    /// Diff side selected by the caller.
    pub side: Side,
}

/// A side of a pull request's diff.
#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Side {
    /// Removed/base line.
    Left,
    /// Added/head line.
    Right,
}

/// Identity of a created review or comment.
#[derive(Clone, Debug, Deserialize)]
pub struct Created {
    /// GitHub record ID.
    pub id: i64,
    /// GitHub's browser URL.
    pub html_url: String,
}

/// PR reads and writes; cloud review product policy belongs to a later milestone.
#[unimock::unimock(api = PullRequestsMock)]
pub trait PullRequests: Send + Sync {
    /// Fetch current state of one PR.
    fn get(&self, installation: i64, repository: &str, number: i64) -> Result<PullRequest>;
    /// List current PRs of the requested state.
    fn list(&self, installation: i64, repository: &str, state: State) -> Result<Vec<PullRequest>>;
    /// Submit a review pinned to a commit.
    fn review(
        &self,
        installation: i64,
        repository: &str,
        number: i64,
        review: &Review,
    ) -> Result<Created>;
    /// Create a review comment pinned to a diff line.
    fn comment(
        &self,
        installation: i64,
        repository: &str,
        number: i64,
        comment: &Comment,
    ) -> Result<Created>;
}
