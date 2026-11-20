//! Per-attempt upload digests and atomic ranked outcomes.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, PublicationId};
use uuid::Uuid;

use crate::build_clock::BuildClock;
use crate::build_state::UploadOutcome;
use crate::error::Result;

/// Stored capability digest; no raw token or serialization surface.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildUploadGrant {
    /// Pre-generated UUID v7.
    pub id: Uuid,
    /// Build audience.
    pub build_id: BuildId,
    /// Attempt audience.
    pub attempt: i32,
    /// SHA-256 of the random token.
    pub token_digest: [u8; 32],
    /// Attempt deadline.
    pub expires_at: DateTime<Utc>,
    /// First accepted completion time.
    pub consumed_at: Option<DateTime<Utc>>,
    /// Highest-ranked answered request, with equal ranks taking the latest value.
    pub outcome: Option<UploadOutcome>,
    /// Server mint time.
    pub created_at: DateTime<Utc>,
}

/// Query-only grant operations; ingest owns authorization and envelope checks.
#[unimock::unimock(api = BuildUploadGrantsMock)]
pub trait BuildUploadGrants {
    /// Mint one grant per running attempt, with its exact deadline.
    fn mint_build_grant(&mut self, grant: &BuildUploadGrant) -> Result<bool>;
    /// Resolve an attempt's capability digest, including consumed and expired rows.
    fn build_grant(&mut self, digest: &[u8; 32]) -> Result<Option<BuildUploadGrant>>;
    /// Lock the grant's project, build, grant and completion publications in order.
    /// Call before authorization and any publication write in completion.
    /// Returns false when the grant or its parent is absent.
    fn lock_build_grant(&mut self, digest: &[u8; 32]) -> Result<bool>;
    /// Read the attempt's stored outcome for finalization.
    fn build_attempt_grant(
        &mut self,
        build: BuildId,
        attempt: i32,
    ) -> Result<Option<BuildUploadGrant>>;
    /// Consume an unexpired grant and attach the ready winner to its live attempt.
    /// Sample the shared clock guard after project, build, grant and publication locks.
    /// Both changes commit in this transaction; equality with any expiry is expired.
    fn consume_build_grant(
        &mut self,
        id: Uuid,
        publication: PublicationId,
        clock: &dyn BuildClock,
    ) -> Result<bool>;
    /// Atomically keep the highest rank: accepted, refusal, unavailable.
    fn record_build_upload_outcome(&mut self, id: Uuid, outcome: UploadOutcome) -> Result<bool>;
}
