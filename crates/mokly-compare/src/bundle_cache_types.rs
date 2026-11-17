//! Bounded raw bundle-cache IO behind the shared storage and lock boundaries.

use std::io::{Read, Seek};

use mokly_platform::locks::FileLock;
use mokly_sidecar::bundle_outcomes::SkipReason;
use mokly_sidecar::bundle_store::RecordToken;

use crate::error::{Error, Result};

/// Complete and reserved bundle data, including receipt charges.
pub(crate) const CAPACITY: u64 = 512 * 1024 * 1024;
/// Space reserved for one bounded completion receipt.
pub(crate) const RECEIPT_BYTES: u64 = 1024;

/// Streaming input that can return to its payload after digest verification.
pub trait BundleInput: Read + Seek + Send + Sync {}

impl<T: Read + Seek + Send + Sync> BundleInput for T {}

/// Bundle-only receipt. Access updates preserve its publication identity.
#[derive(Clone, Debug)]
pub struct BundleReceipt {
    /// Full reservation, including the receipt charge.
    pub bytes: u64,
    /// Monotonic LRU sequence.
    pub used: u64,
    /// Fresh identity of this publication.
    pub publication: RecordToken,
}

/// A complete or incomplete owned directory from a bounded namespace scan.
#[derive(Clone, Debug)]
pub struct BundleRecord {
    /// Entry or stage name.
    pub key: String,
    /// Conservative complete or staged disk charge.
    pub bytes: u64,
    /// Receipt when it validates, absent for incomplete data.
    pub receipt: Option<BundleReceipt>,
}

/// Filesystem inspection before its caller adds the shared stripe guard.
pub enum OpenBundle {
    /// The entry directory does not exist.
    Absent,
    /// The bounded receipt and one data file match.
    Complete {
        /// Open file, checked for cancellation during reads.
        input: Box<dyn BundleInput>,
        /// Exact whole-file size before payload parsing.
        bytes: u64,
        /// Valid completion receipt.
        receipt: BundleReceipt,
    },
    /// Invalid receipt or data. A token proves a valid receipt when present.
    Damaged(Option<RecordToken>),
    /// Entry read failure, separate from namespace and lock faults.
    Unreadable(Option<RecordToken>),
}

/// Input and its shared stripe lease, retained only inside one store load.
pub struct RawEntry {
    /// Declared first, so it closes before the guard during destruction.
    pub input: Box<dyn BundleInput>,
    /// Exact whole-file size.
    pub bytes: u64,
    /// Publication identity independent of the access sequence.
    pub token: RecordToken,
    /// Optional access-order failure, without losing the open entry.
    pub maintenance: Option<Error>,
    /// Shared stripe lease. It never crosses a BundleStore call.
    pub guard: Box<dyn FileLock>,
}

/// Raw load outcomes before versioned payload decoding.
pub enum RawRead {
    /// One leased, completed data file.
    Entry(RawEntry),
    /// No entry exists.
    Absent,
    /// Another caller holds the stripe.
    Contended,
    /// Receipt or data layout is invalid.
    Damaged(Option<RecordToken>),
    /// The receipt or file could not be read.
    Unreadable(Option<RecordToken>),
}

/// Normal or successful completion of a raw mutation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Mutation {
    /// A durable entry was published.
    Written,
    /// A rejected entry was removed.
    Invalidated,
    /// A normal event prevented mutation.
    Skipped(SkipReason),
}

/// Nonblocking bundle operations over the shared disk cache implementation.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BundleCacheMock))]
pub trait BundleCache: Send + Sync {
    /// Read with one shared stripe attempt and optional access-order update.
    fn read(&self, key: &str) -> Result<RawRead>;
    /// Reserve room, stage, flush, and atomically publish one full file.
    fn replace(&self, key: &str, bytes: &[u8]) -> Result<Mutation>;
    /// Remove matching data, or data whose receipt remains invalid.
    fn invalidate(&self, key: &str, token: Option<RecordToken>) -> Result<Mutation>;
    /// Read command or pool cancellation after an interrupted input read.
    fn cancelled(&self) -> bool;
}
