//! Durable publication events and one-use catalogue access grants.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{ProjectId, PublicationId, UserId};
use uuid::Uuid;

use crate::error::Result;

/// Publication event classifications.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventKind {
    /// Request admitted.
    Uploading,
    /// Parsed envelope identity authorized for this publication.
    Validating,
    /// Catalogue atomically became available.
    Ready,
    /// Attempt ended without a catalogue.
    Failed,
    /// Retention removed catalogue bytes.
    Expired,
    /// An authorized provider rerequest asks for the same immutable result.
    Rerequest,
}

impl EventKind {
    /// Stable database representation.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Uploading => "uploading",
            Self::Validating => "validating",
            Self::Ready => "ready",
            Self::Failed => "failed",
            Self::Expired => "expired",
            Self::Rerequest => "rerequest",
        }
    }
}

/// Persisted delivery input; event IDs are generated outside transactions.
#[derive(Clone, Debug)]
pub struct PublicationEvent {
    /// Unique event identity.
    pub id: Uuid,
    /// Publication whose immutable state is read during delivery.
    pub publication_id: PublicationId,
    /// Event category.
    pub kind: EventKind,
    /// Server occurrence time.
    pub created_at: DateTime<Utc>,
}

/// Due outbox delivery and its optimistic retry version.
#[derive(Clone, Debug)]
pub struct PendingEvent {
    /// Immutable event to deliver.
    pub event: PublicationEvent,
    /// Monotonic retry version, advanced on claim or operator requeue.
    pub attempts: i32,
    /// Permanent failures since the most recent operator requeue.
    pub permanent_failures: i32,
}

/// Successful delivery claim and its current retry budget.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EventClaim {
    /// Advanced version that must fence every outcome write.
    pub attempts: i32,
    /// Current permanent failures, read atomically with the claim.
    pub permanent_failures: i32,
}

/// One-use secret digest bound to a user and publication.
#[derive(Clone, Debug)]
pub struct CatalogueGrant {
    /// SHA-256 of the random grant; never a raw credential.
    pub digest: String,
    /// Host audience.
    pub publication_id: PublicationId,
    /// Authorized member identity.
    pub user_id: UserId,
    /// Inclusive rejection deadline.
    pub expires_at: DateTime<Utc>,
}

/// Event and grant queries, with no provider or cryptographic behavior.
#[unimock::unimock(api = PublicationEventsMock)]
pub trait PublicationEvents {
    /// Count only undelivered dead letters for operator alerting.
    fn dead_letter_count(&mut self) -> Result<i64>;
    /// Append an event inside its state-change transaction.
    fn insert_publication_event(&mut self, event: &PublicationEvent) -> Result<()>;
    /// Due events, optionally scoped to a project before applying the limit.
    fn pending_publication_events(
        &mut self,
        now: DateTime<Utc>,
        limit: i64,
        project: Option<ProjectId>,
    ) -> Result<Vec<PendingEvent>>;
    /// Claim one due event at the observed version until the supplied deadline.
    /// Returns the advanced version and current budget, or no claim if another
    /// worker owns the event or it is no longer eligible.
    fn claim_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        at: DateTime<Utc>,
        until: DateTime<Utc>,
    ) -> Result<Option<EventClaim>>;
    /// Record failure at the claimed version without advancing it again.
    /// Returns false when a newer claim, requeue or delivery fenced this outcome.
    fn retry_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        permanent_failures: i32,
        next_attempt_at: DateTime<Utc>,
        dead_lettered_at: Option<DateTime<Utc>>,
    ) -> Result<bool>;
    /// Make an undelivered dead letter due now and reset only its permanent budget.
    fn requeue_publication_event(&mut self, id: Uuid, now: DateTime<Utc>) -> Result<bool>;
    /// Acknowledge success only at the claimed version; stale outcomes return false.
    fn deliver_publication_event(
        &mut self,
        id: Uuid,
        attempts: i32,
        at: DateTime<Utc>,
    ) -> Result<bool>;
    /// Store a one-use capability digest.
    fn insert_catalogue_grant(&mut self, grant: &CatalogueGrant) -> Result<()>;
    /// Atomically remove and return a matching unexpired grant.
    fn consume_catalogue_grant(
        &mut self,
        digest: &str,
        publication: PublicationId,
        now: DateTime<Utc>,
    ) -> Result<Option<CatalogueGrant>>;
    /// Remove expired grants without exposing their hashes.
    fn prune_catalogue_grants(&mut self, now: DateTime<Utc>) -> Result<()>;
}
