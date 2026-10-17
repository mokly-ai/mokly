//! An added or removed view does not invent an added or removed current entry.

use mokly_compare::comparison_types::EntryClassification;
use mokly_model::axes::EntryKind;
use mokly_model::public_metadata::{CatalogueChanges, ChangeKind, ChangesStatus};
use mokly_model::readers;
use mokly_model::review::{EntryChangeReason, ReviewState};

use crate::changes_index::common;

#[test]
fn axis_changes_keep_the_surviving_entry_changed() {
    for state in [ReviewState::Added, ReviewState::Removed] {
        let mut entry = readers::index(include_str!(
            "../../../../docs/protocol/fixtures/catalogue-v7.json"
        ))
        .unwrap()
        .screens[0]
            .entry
            .clone();
        let path = entry.path.clone();
        common(
            &mut entry,
            ChangesStatus::Ready,
            Some(&EntryClassification {
                kind: EntryKind::Screen,
                path,
                previous_path: None,
                state,
                included: true,
                reasons: vec![EntryChangeReason::Metadata],
                documents: vec![],
            }),
        );
        assert_eq!(
            entry.changes,
            CatalogueChanges::Ready {
                kind: ChangeKind::Changed,
                included: true
            }
        );
        common(&mut entry, ChangesStatus::Pending, None);
        assert_eq!(entry.changes, CatalogueChanges::Pending);
        assert!(entry.previous_path.is_none());
    }
}
