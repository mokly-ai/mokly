//! Minimal typed GitHub event projections; raw payloads remain separately stored.

use serde::Deserialize;

#[derive(Deserialize)]
pub(super) struct Id {
    pub(super) id: i64,
}

#[derive(Deserialize)]
pub(super) struct RepositoryMetadata {
    pub(super) id: i64,
    pub(super) full_name: String,
    pub(super) private: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum InstallationAction {
    Created,
    Deleted,
    Suspend,
    Unsuspend,
    NewPermissionsAccepted,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
pub(super) struct InstallationEvent {
    pub(super) action: InstallationAction,
    pub(super) installation: Id,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum SelectionAction {
    Added,
    Removed,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
pub(super) struct RepositoriesEvent {
    pub(super) action: SelectionAction,
    pub(super) installation: Id,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum RepositoryAction {
    Edited,
    Created,
    Renamed,
    Transferred,
    Privatized,
    Publicized,
    Deleted,
    Archived,
    Unarchived,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
pub(super) struct RepositoryEvent {
    pub(super) action: RepositoryAction,
    pub(super) installation: Id,
    pub(super) repository: RepositoryMetadata,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum PullAction {
    Opened,
    Reopened,
    Closed,
    Synchronize,
    Edited,
    ConvertedToDraft,
    ReadyForReview,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
pub(super) struct PullEvent {
    pub(super) action: PullAction,
    pub(super) installation: Id,
    pub(super) repository: RepositoryMetadata,
    pub(super) number: i64,
}

#[derive(Deserialize)]
pub(super) struct PushEvent {
    pub(super) installation: Id,
    pub(super) repository: RepositoryMetadata,
    #[serde(rename = "ref")]
    pub(super) reference: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) enum CheckAction {
    Requested,
    Rerequested,
    #[serde(other)]
    Unknown,
}

#[derive(Deserialize)]
pub(super) struct Check {
    pub(super) id: i64,
    pub(super) app: Id,
    pub(super) head_sha: String,
}

#[derive(Deserialize)]
pub(super) struct CheckRunEvent {
    pub(super) action: CheckAction,
    pub(super) installation: Id,
    pub(super) repository: RepositoryMetadata,
    pub(super) check_run: Check,
}

#[derive(Deserialize)]
pub(super) struct CheckSuiteEvent {
    pub(super) action: CheckAction,
    pub(super) installation: Id,
    pub(super) repository: RepositoryMetadata,
    pub(super) check_suite: Check,
}
