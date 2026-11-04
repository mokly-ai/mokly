//! Indexed identities retain sides, kind isolation, and absent base behavior.

use mokly_model::axes::EntryKind;
use mokly_model::review_affected::ReviewSide;

use crate::lookup::{Destination, Lookup};
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
    let lookup = Lookup::new(&after, Some(&before), &[], &moves);
    assert_eq!(
        lookup
            .entry(ReviewSide::Before, EntryKind::Component, "OLD")
            .unwrap()
            .metadata
            .path,
        "Old"
    );
    assert!(matches!(
        lookup.reference(ReviewSide::Before, EntryKind::Component, "OLD"),
        Some(Destination::Current(entry)) if entry.metadata.path == "New"
    ));
    assert!(
        lookup
            .entry(ReviewSide::After, EntryKind::Component, "Old")
            .is_none()
    );
    assert!(
        lookup
            .reference(ReviewSide::After, EntryKind::Component, "Old")
            .is_none()
    );
    assert!(
        lookup
            .reference(ReviewSide::Before, EntryKind::Screen, "Old")
            .is_none()
    );
    assert_eq!(lookup.previous(EntryKind::Component, "NEW"), Some("Old"));
    assert_eq!(lookup.counterpart(EntryKind::Component, "NEW"), Some("Old"));
}

#[test]
fn absent_base_does_not_invent_counterparts() {
    let current = model(vec![entry("New", EntryKind::Component, None)]);
    let lookup = Lookup::new(&current, None, &[], &[]);
    assert_eq!(lookup.counterpart(EntryKind::Component, "New"), None);
}
