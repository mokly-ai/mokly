//! One exhaustive mapping from store events to timing, warnings, and state.

/// Catalogue bundle timing values, independent of the sidecar wire.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CacheOutcome {
    /// A disk seed supplied the compilation.
    Hit,
    /// A memory compilation supplied the result.
    Memory,
    /// No stored compilation exists.
    NoRecord,
    /// A stored compilation failed its current-input check.
    StampMismatch,
    /// The file names another format or Mokly version.
    VersionMismatch,
    /// The entry cannot supply its recorded recipe.
    Damaged,
    /// A lock or the store prevented a lookup.
    Unavailable,
}

impl CacheOutcome {
    /// Stable value of the catalogue bundle timing field.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hit => "hit",
            Self::Memory => "memory",
            Self::NoRecord => "no-record",
            Self::StampMismatch => "stamp-mismatch",
            Self::VersionMismatch => "version-mismatch",
            Self::Damaged => "damaged",
            Self::Unavailable => "unavailable",
        }
    }
}

/// Recoverable faults confined to one stored entry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EntryFault {
    /// The format or Mokly version differs.
    VersionMismatch,
    /// The decoded kind or settings differ.
    WrongSettings,
    /// Receipt, size, header, digest, or payload is invalid.
    Damaged,
    /// The entry file could not be read.
    Unreadable,
}

/// Silent reasons for a skipped store mutation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SkipReason {
    /// Another caller holds a required lock.
    Contended,
    /// Complete and staged entries leave insufficient space.
    Capacity,
    /// The file or its actual seed request exceeds its read limit.
    Oversized,
    /// The current publication no longer matches the rejected seed.
    Changed,
    /// No publication exists to remove.
    Absent,
    /// The monotonic access sequence has no next value.
    SequenceExhausted,
}

/// Store availability after an operation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StoreState {
    /// Later calls can use the store.
    On,
    /// A store fault disabled later calls.
    Off,
}

/// Bounded warning facts from one operation and its rejected-entry removal.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Warnings {
    /// Report the recoverable entry warning.
    pub entry: bool,
    /// Report the once-only directory warning.
    pub directory: bool,
}

/// The shared interpretation used by timing and terminal composition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Effects {
    /// A timing cause, absent for a successful or silent mutation.
    pub cache: Option<CacheOutcome>,
    /// Warning facts, without terminal text or library output.
    pub warnings: Warnings,
    /// Store availability after this result.
    pub state: StoreState,
}

impl Effects {
    /// Preserve one entry fault together with a later bounded directory warning.
    pub fn with_entry_fault(self, fault: EntryFault) -> Self {
        let mut rejected = StoreEvent::Rejected(fault).effects();
        rejected.state = self.state;
        rejected.warnings.directory = self.warnings.directory;
        if self.state == StoreState::Off {
            rejected.cache = self.cache;
        }
        rejected
    }
}

/// Exhaustive event vocabulary shared by reads and mutations.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StoreEvent {
    /// A complete disk recipe was loaded.
    Hit,
    /// No entry exists.
    Absent,
    /// A recoverable entry fault occurred.
    Rejected(EntryFault),
    /// A read met a held stripe.
    Contended,
    /// A recipe was written or a rejected publication was removed.
    Stored,
    /// A normal event prevented a mutation.
    Skipped(SkipReason),
    /// Command or pool cancellation stopped the operation.
    Cancelled,
    /// This operation first disabled the store.
    StoreFault,
    /// An earlier fault already disabled the store.
    Disabled,
}

impl StoreEvent {
    /// Map each event once, so output and timing cannot disagree.
    pub fn effects(self) -> Effects {
        let mut effects = Effects {
            cache: None,
            warnings: Warnings::default(),
            state: StoreState::On,
        };
        match self {
            Self::Hit => effects.cache = Some(CacheOutcome::Hit),
            Self::Absent => effects.cache = Some(CacheOutcome::NoRecord),
            Self::Rejected(fault) => {
                effects.cache = Some(match fault {
                    EntryFault::VersionMismatch => CacheOutcome::VersionMismatch,
                    EntryFault::WrongSettings | EntryFault::Damaged | EntryFault::Unreadable => {
                        CacheOutcome::Damaged
                    }
                });
                effects.warnings.entry = true;
            }
            Self::Contended => effects.cache = Some(CacheOutcome::Unavailable),
            Self::StoreFault => {
                effects.cache = Some(CacheOutcome::Unavailable);
                effects.warnings.directory = true;
                effects.state = StoreState::Off;
            }
            Self::Disabled => {
                effects.cache = Some(CacheOutcome::Unavailable);
                effects.state = StoreState::Off;
            }
            Self::Stored | Self::Skipped(_) | Self::Cancelled => {}
        }
        effects
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_outcomes_tests.rs"]
mod bundle_outcomes_tests;
