//! Internal reference context retained alongside public owner-only closure evidence.

use mokly_model::evidence::EvidenceOwner;

/// One reached edge with its actual logical instance, never a guessed saved variant.
#[derive(Clone, Debug)]
pub struct ResourceReach {
    /// Resolved public target route.
    pub path: String,
    /// Logical material supplier.
    pub owner: EvidenceOwner,
    /// Exact instance key in the composed view, absent on own-root or entry references.
    pub instance_key: Option<String>,
    /// Public route containing this reference.
    pub source: String,
    /// Authored reference spelling on that side.
    pub url: String,
}
