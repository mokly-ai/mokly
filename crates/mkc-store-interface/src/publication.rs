//! Immutable publication records and query-only lifecycle operations.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Result;
use crate::publication_changes::Changes;

#[cfg(test)]
#[path = "_tests_/publication_failure_tests.rs"]
mod publication_failure_tests;

/// Accepted immutable producer metadata, present after envelope validation and authorization.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationMetadata {
    /// Producer branch name.
    pub branch: String,
    /// Actual source object identity.
    pub head_sha: String,
    /// Comparison ref, paired with its pinned base.
    pub base_ref: Option<String>,
    /// Pinned merge-base object identity, present exactly when there is a comparison.
    pub base_sha: Option<String>,
    /// Producer-reported pull request, never proof that it is open.
    pub pull_request: Option<i64>,
    /// Authorized project config path.
    pub config_path: String,
    /// Producer time, never used for ordering or expiry.
    pub exported_at: DateTime<Utc>,
}

/// Monotonic lifecycle state.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PublicationState {
    /// Receiving and decoding a bounded request.
    Uploading,
    /// Envelope identity authorized; content validation and storage may be unfinished.
    Validating,
    /// Complete immutable catalogue available for serving.
    Ready,
    /// Terminal failed attempt; files cannot be served.
    Failed,
    /// Retention removed the catalogue; immutable history remains.
    Expired,
}

impl PublicationState {
    /// Stable database representation.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Uploading => "uploading",
            Self::Validating => "validating",
            Self::Ready => "ready",
            Self::Failed => "failed",
            Self::Expired => "expired",
        }
    }
}

/// Persisted failure classifications, independent of HTTP diagnostics.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PublicationFailure {
    /// Contract rejection.
    InvalidBundle,
    /// Producer artifact version is unsupported.
    UnsupportedVersion,
    /// An upload ceiling was exceeded.
    TooLarge,
    /// Authorization was revoked or metadata did not match.
    Unauthorized,
    /// An unhandled dependency failed; never a failing Changes check.
    Internal,
    /// Attempt outlived its deadline.
    Expired,
    /// Another valid attempt committed this identity first.
    Superseded,
}

impl PublicationFailure {
    /// Only invalid ingest produces a red Changes check; enumerate every outcome.
    pub fn delivers_failure_check(self) -> bool {
        match self {
            Self::InvalidBundle | Self::UnsupportedVersion | Self::TooLarge => true,
            Self::Unauthorized | Self::Internal | Self::Expired | Self::Superseded => false,
        }
    }

    /// Stable database representation.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InvalidBundle => "invalid-bundle",
            Self::UnsupportedVersion => "unsupported-version",
            Self::TooLarge => "too-large",
            Self::Unauthorized => "unauthorized",
            Self::Internal => "internal",
            Self::Expired => "expired",
            Self::Superseded => "superseded",
        }
    }
}

/// Stored publication or authenticated upload attempt.
#[derive(Clone, Debug)]
pub struct Publication {
    /// Server-generated immutable ID.
    pub id: PublicationId,
    /// Authorized owning project.
    pub project_id: ProjectId,
    /// Cloud build that admitted this upload, if any.
    pub build_id: Option<BuildId>,
    /// Reserved UUID v7 for attempt-ending cleanup, generated before admission.
    ///
    /// The admission caller allocates a unique ID before its transaction and stores
    /// it here for every build-linked upload. An ending transaction reuses that ID
    /// for the failed event and sets its event time to the build transition time.
    /// It never allocates another ID. Reserving the ID at admission covers uploads
    /// admitted after cleanup starts, without a pre-read race or a fixed upload
    /// limit. Conditional closure inserts the event once.
    pub build_failure_event_id: Option<Uuid>,
    /// Absent until the envelope is parsed and authorized.
    pub metadata: Option<PublicationMetadata>,
    /// Current monotonic lifecycle state.
    pub state: PublicationState,
    /// Failure for failed attempts only.
    pub failure: Option<PublicationFailure>,
    /// Accepted Changes observation; absent until the ready transition commits.
    pub changes: Option<Changes>,
    /// Server admission time, used to order history and aliases.
    pub created_at: DateTime<Utc>,
    /// Final deadline enforced by the database ready transition.
    pub deadline: DateTime<Utc>,
    /// Removed catalogue content; metadata remains available for history.
    pub expired_at: Option<DateTime<Utc>>,
}

/// Publication queries executed inside the caller's transaction.
#[unimock::unimock(api = PublicationsMock)]
pub trait Publications {
    /// Read an attempt or publication.
    fn publication(&mut self, id: PublicationId) -> Result<Option<Publication>>;
    /// Read project history, newest admitted first.
    fn publications(&mut self, project: ProjectId) -> Result<Vec<Publication>>;
    /// Insert one authenticated uploading attempt.
    fn insert_publication(&mut self, publication: &Publication) -> Result<()>;
    /// Attach immutable validated metadata once.
    fn validate_publication(
        &mut self,
        id: PublicationId,
        metadata: &PublicationMetadata,
    ) -> Result<bool>;
    /// Atomically retain Changes and commit ready before the server deadline.
    fn ready_publication(&mut self, id: PublicationId, changes: Changes) -> Result<bool>;
    /// Change an unfinished attempt to failed, without resurrecting terminal states.
    fn fail_publication(&mut self, id: PublicationId, failure: PublicationFailure) -> Result<bool>;
    /// Close one ending build attempt's unfinished uploads, release references,
    /// and insert failed events in the caller's build-transition transaction.
    /// `since` is the attempt's stored start time; earlier attempts stay unchanged.
    fn fail_build_uploads(
        &mut self,
        build: BuildId,
        since: DateTime<Utc>,
        failure: PublicationFailure,
        at: DateTime<Utc>,
    ) -> Result<i64>;
    /// Find the ready, retained idempotency winner; expired heads may be republished.
    fn publication_by_identity(
        &mut self,
        project: ProjectId,
        head: &str,
        config: &str,
    ) -> Result<Option<Publication>>;
    /// Find the newest ready, retained publication for a branch.
    fn latest_publication(
        &mut self,
        project: ProjectId,
        branch: &str,
    ) -> Result<Option<Publication>>;
    /// Mark a ready publication expired before its files are released.
    fn expire_publication(&mut self, id: PublicationId, at: DateTime<Utc>) -> Result<bool>;
    /// Delete failed-attempt metadata after its retention window.
    fn delete_failed_publication(
        &mut self,
        id: PublicationId,
        before: DateTime<Utc>,
    ) -> Result<bool>;
    /// Bounded ID-ordered candidates: due unfinished attempts or old failed rows.
    /// Exclude ready and expired publications before applying the limit.
    fn publication_candidates(
        &mut self,
        now: DateTime<Utc>,
        retained_before: DateTime<Utc>,
        after: Option<PublicationId>,
        limit: i64,
    ) -> Result<Vec<Publication>>;
    /// Register an immutable branch alias identity.
    fn insert_branch_alias(&mut self, alias: &str, project: ProjectId, branch: &str) -> Result<()>;
    /// Resolve an alias to its current ready retained publication.
    fn branch_alias(&mut self, alias: &str) -> Result<Option<Publication>>;
}
