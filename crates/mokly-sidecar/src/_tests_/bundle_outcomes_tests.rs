//! Fault classes share one interpretation for terminal and timing composition.

use crate::bundle_outcomes::{
    CacheOutcome, EntryFault, SkipReason, StoreEvent, StoreState, Warnings,
};
use crate::bundle_store::{ReadOutcome, WriteOutcome};

#[test]
fn entry_faults_warn_while_contention_and_normal_mutations_stay_silent() {
    for (event, cache, warnings, state) in [
        (
            StoreEvent::Rejected(EntryFault::VersionMismatch),
            Some(CacheOutcome::VersionMismatch),
            Warnings {
                entry: true,
                directory: false,
            },
            StoreState::On,
        ),
        (
            StoreEvent::Rejected(EntryFault::WrongSettings),
            Some(CacheOutcome::Damaged),
            Warnings {
                entry: true,
                directory: false,
            },
            StoreState::On,
        ),
        (
            StoreEvent::Rejected(EntryFault::Damaged),
            Some(CacheOutcome::Damaged),
            Warnings {
                entry: true,
                directory: false,
            },
            StoreState::On,
        ),
        (
            StoreEvent::Rejected(EntryFault::Unreadable),
            Some(CacheOutcome::Damaged),
            Warnings {
                entry: true,
                directory: false,
            },
            StoreState::On,
        ),
        (
            StoreEvent::Contended,
            Some(CacheOutcome::Unavailable),
            Warnings::default(),
            StoreState::On,
        ),
        (
            StoreEvent::StoreFault,
            Some(CacheOutcome::Unavailable),
            Warnings {
                entry: false,
                directory: true,
            },
            StoreState::Off,
        ),
        (
            StoreEvent::Disabled,
            Some(CacheOutcome::Unavailable),
            Warnings::default(),
            StoreState::Off,
        ),
        (
            StoreEvent::Cancelled,
            None,
            Warnings::default(),
            StoreState::On,
        ),
        (
            StoreEvent::Skipped(SkipReason::Capacity),
            None,
            Warnings::default(),
            StoreState::On,
        ),
        (
            StoreEvent::Skipped(SkipReason::Oversized),
            None,
            Warnings::default(),
            StoreState::On,
        ),
    ] {
        let effects = event.effects();
        assert_eq!(
            (effects.cache, effects.warnings, effects.state),
            (cache, warnings, state),
            "{event:?}"
        );
    }
}

#[test]
fn a_retirement_store_fault_preserves_both_warnings_and_disables_the_store() {
    let result = ReadOutcome::Rejected {
        fault: EntryFault::Damaged,
        retirement: WriteOutcome::StoreFault,
    };
    let effects = result.effects();
    assert_eq!(effects.cache, Some(CacheOutcome::Unavailable));
    assert_eq!(
        effects.warnings,
        Warnings {
            entry: true,
            directory: true
        }
    );
    assert_eq!(effects.state, StoreState::Off);
}
