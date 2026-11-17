//! Optional disk recipes, recoverable outcomes, and publication identities.

use crate::bundle_outcomes::{Effects, EntryFault, SkipReason, StoreEvent, StoreState};
use crate::methods::Bundle;
use crate::reusable_recipe::ReusableRecipe;

/// Identity of one publication, independent of its payload and access order.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RecordToken([u8; 32]);

impl RecordToken {
    /// Construct a token from a fresh 256-bit nonce.
    pub fn new(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Read a bounded lowercase or uppercase hexadecimal publication id.
    pub fn parse(value: &str) -> Option<Self> {
        if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return None;
        }
        let mut bytes = [0; 32];
        for (target, pair) in bytes.iter_mut().zip(value.as_bytes().chunks_exact(2)) {
            let text = std::str::from_utf8(pair).ok()?;
            *target = u8::from_str_radix(text, 16).ok()?;
        }
        Some(Self(bytes))
    }

    /// Fixed-size receipt spelling.
    pub fn hex(self) -> String {
        self.0.iter().map(|byte| format!("{byte:02x}")).collect()
    }
}

/// Recoverable miss reasons that do not supply an entry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReadMiss {
    /// No completed entry exists.
    Absent,
    /// Another caller holds the entry stripe.
    Contended,
    /// Command or pool cancellation stopped the read.
    Cancelled,
    /// The first store fault disables this process's store.
    StoreFault,
    /// The store was already disabled.
    Disabled,
}

/// Exhaustive outcome of a write or rejected-entry invalidation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WriteOutcome {
    /// The complete recipe was published.
    Written,
    /// The still-rejected publication was removed.
    Invalidated,
    /// No optional maintenance was needed.
    Unchanged,
    /// A normal event skipped the mutation.
    Skipped(SkipReason),
    /// Command or pool cancellation stopped the mutation.
    Cancelled,
    /// This mutation first disabled the store.
    StoreFault,
    /// An earlier fault already disabled the store.
    Disabled,
}

impl WriteOutcome {
    /// Interpret this mutation through the common exhaustive mapping.
    pub fn effects(self) -> Effects {
        self.event().effects()
    }

    fn event(self) -> StoreEvent {
        match self {
            Self::Written | Self::Invalidated | Self::Unchanged => StoreEvent::Stored,
            Self::Skipped(reason) => StoreEvent::Skipped(reason),
            Self::Cancelled => StoreEvent::Cancelled,
            Self::StoreFault => StoreEvent::StoreFault,
            Self::Disabled => StoreEvent::Disabled,
        }
    }
}

/// A load either supplies one complete recipe or a recoverable miss.
#[derive(Clone, Debug)]
pub enum ReadOutcome {
    /// A complete recipe and the identity required to invalidate it safely.
    Hit {
        /// Complete compilation envelope.
        recipe: Box<ReusableRecipe>,
        /// Original publication identity, preserved by receipt touches.
        token: RecordToken,
        /// Optional access maintenance never discards this loaded recipe.
        maintenance: WriteOutcome,
    },
    /// No reusable entry was supplied.
    Miss(ReadMiss),
    /// An entry fault and the bounded outcome of its removal attempt.
    Rejected {
        /// Why this entry cannot supply a seed.
        fault: EntryFault,
        /// One nonblocking attempt to remove the still-rejected publication.
        retirement: WriteOutcome,
    },
}

impl ReadOutcome {
    /// Keep both warning facts when removal itself makes the store unusable.
    pub fn effects(&self) -> Effects {
        match self {
            Self::Hit { maintenance, .. } => {
                let mut effects = StoreEvent::Hit.effects();
                let maintained = maintenance.effects();
                effects.state = maintained.state;
                effects.warnings = maintained.warnings;
                effects
            }
            Self::Miss(reason) => match reason {
                ReadMiss::Absent => StoreEvent::Absent,
                ReadMiss::Contended => StoreEvent::Contended,
                ReadMiss::Cancelled => StoreEvent::Cancelled,
                ReadMiss::StoreFault => StoreEvent::StoreFault,
                ReadMiss::Disabled => StoreEvent::Disabled,
            }
            .effects(),
            Self::Rejected { fault, retirement } => {
                let mut effects = StoreEvent::Rejected(*fault).effects();
                let removed = retirement.effects();
                if removed.state == StoreState::Off {
                    effects.cache = removed.cache;
                    effects.state = removed.state;
                    effects.warnings.directory = removed.warnings.directory;
                }
                effects
            }
        }
    }
}

/// Optional persistent compilation recipes. No result fails a bundle command.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = BundleStoreMock))]
pub trait BundleStore: Send + Sync {
    /// Load a complete recipe and release every file and lock before returning.
    fn load(&self, params: &Bundle) -> ReadOutcome;
    /// Publish a complete recipe when its file and actual seed request fit.
    fn save(&self, recipe: &ReusableRecipe) -> WriteOutcome;
    /// Remove a failed restore only if its publication still matches.
    fn invalidate(&self, params: &Bundle, token: &RecordToken) -> WriteOutcome;
}
