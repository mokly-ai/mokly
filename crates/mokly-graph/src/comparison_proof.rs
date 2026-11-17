//! Explicit content proofs for comparison reads, with a source-free admission mode.

use mokly_model::usage::CatalogueUsage;
use sha2::{Digest, Sha256};

/// The generation operation whose complete result must remain equal.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ComparisonRead {
    /// Composed document bytes, annotations, usage, and validation inputs.
    Document,
    /// Complete closure, including policy, membership, warnings, and ownership.
    Closure,
    /// Exact resource content or proved absence.
    Resource,
}

/// A content identity. Unknown content is represented by no identity.
pub type ContentIdentity = [u8; 32];

/// Current document proof and usage obtained from the same checked artifact.
pub struct DocumentProof {
    /// Complete checked document identity.
    pub identity: ContentIdentity,
    /// Current usage, absent only when the checked artifact has no document.
    pub usage: Option<CatalogueUsage>,
}

/// Whether a proof may consult the source of the current head generation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProofMode {
    /// No source IO, source failures, restoration, or fallback is permitted.
    Retained,
    /// Head proof reads may consult current resources. Failed reads are misses.
    Current,
}

/// Hash structured or byte input into a fixed resident identity.
pub fn content_identity(bytes: &[u8]) -> ContentIdentity {
    Sha256::digest(bytes).into()
}
