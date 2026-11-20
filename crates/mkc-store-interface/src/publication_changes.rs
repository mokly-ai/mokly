//! Immutable Changes observations captured from validated uploads.

/// Included catalogue index Changes totals, including paired pure moves.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Counts {
    /// Entries present only after.
    pub added: u64,
    /// Paired directly changed entries.
    pub changed: u64,
    /// Entries present only before.
    pub removed: u64,
}

/// Accepted comparison observation, retained independently of catalogue bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Changes {
    /// The accepted upload explicitly has no comparison.
    NoComparison,
    /// The accepted comparison has these totals, including genuine zeroes.
    Available(Counts),
}
