//! Indexed identities retain sides, kind isolation, and the accepted-generation fence.

use mokly_model::axes::EntryKind;
use mokly_model::review_affected::ReviewSide;

use crate::lookup::{Destination, Lookup, LookupError};
use crate::move_types::MovePair;

use super::support::{entry, model};

#[test]
fn original_metadata_and_destinations_use_separate_sides() {
    let before = model(vec![entry("Old", EntryKind::Component, None)]);
    let after = model(vec![entry("New", EntryKind::Component, None)]);
    let moves = vec![MovePair {
        kind: EntryKind::Component,
        path: "New".into(),
        previous_path: "Old".into(),
    }];
    let lookup = Lookup::new("accepted", &after, Some(&before), &[], &moves).unwrap();
    assert_eq!(
        lookup
            .entry("accepted", ReviewSide::Before, EntryKind::Component, "OLD")
            .unwrap()
            .unwrap()
            .metadata
            .path,
        "Old"
    );
    assert!(matches!(
        lookup.reference("accepted", ReviewSide::Before, EntryKind::Component, "OLD").unwrap(),
        Some(Destination::Current(entry)) if entry.metadata.path == "New"
    ));
    assert!(
        lookup
            .entry("accepted", ReviewSide::After, EntryKind::Component, "Old")
            .unwrap()
            .is_none()
    );
    assert!(
        lookup
            .reference("accepted", ReviewSide::After, EntryKind::Component, "Old")
            .unwrap()
            .is_none()
    );
    assert!(
        lookup
            .reference("accepted", ReviewSide::Before, EntryKind::Screen, "Old")
            .unwrap()
            .is_none()
    );
    assert_eq!(
        lookup
            .previous("accepted", EntryKind::Component, "NEW")
            .unwrap(),
        Some("Old")
    );
    assert_eq!(
        lookup
            .counterpart("accepted", EntryKind::Component, "NEW")
            .unwrap(),
        Some("Old")
    );
}

#[test]
fn existing_identities_and_case_only_moves_fail_the_same_invariant() {
    let current = model(vec![entry("New", EntryKind::Component, None)]);
    for (path, previous_path) in [("Elsewhere", "NEW"), ("Name", "NAME")] {
        let moves = vec![MovePair {
            kind: EntryKind::Component,
            path: path.into(),
            previous_path: previous_path.into(),
        }];
        assert!(matches!(
            Lookup::new("accepted", &current, None, &[], &moves),
            Err(LookupError::PairInvariant)
        ));
    }
    let moves = vec![MovePair {
        kind: EntryKind::Screen,
        path: "Elsewhere".into(),
        previous_path: "NEW".into(),
    }];
    assert!(Lookup::new("accepted", &current, None, &[], &moves).is_ok());
}

#[test]
fn absent_base_does_not_invent_counterparts_and_all_operations_are_fenced() {
    let current = model(vec![entry("New", EntryKind::Component, None)]);
    let lookup = Lookup::new("accepted", &current, None, &[], &[]).unwrap();
    assert_eq!(
        lookup
            .counterpart("accepted", EntryKind::Component, "New")
            .unwrap(),
        None
    );
    assert!(matches!(
        lookup.entry("stale", ReviewSide::After, EntryKind::Component, "New"),
        Err(LookupError::Generation)
    ));
    assert!(matches!(
        lookup.reference("stale", ReviewSide::After, EntryKind::Component, "New"),
        Err(LookupError::Generation)
    ));
    assert!(matches!(
        lookup.counterpart("stale", EntryKind::Component, "New"),
        Err(LookupError::Generation)
    ));
    assert!(matches!(
        lookup.previous("stale", EntryKind::Component, "New"),
        Err(LookupError::Generation)
    ));
    assert!(matches!(
        lookup.parent("stale", Destination::Current(&current.entries[0])),
        Err(LookupError::Generation)
    ));
}
