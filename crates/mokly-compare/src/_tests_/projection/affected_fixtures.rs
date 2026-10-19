//! Accepted variant moves retain their original owner and separate destination.

use mokly_model::axes::EntryKind;
use mokly_model::review::ReviewState;

use crate::comparison_types::ComparisonResult;
use crate::move_types::{EntryPair, MovePair, Pairing};

use super::support::{classified, entry, paired_result};

pub(super) fn reparented(keep_donor: bool) -> ComparisonResult {
    let before = vec![
        entry("badge", EntryKind::Component, None),
        entry("donor", EntryKind::Component, None),
        entry("donor/primary", EntryKind::Component, Some("donor")),
        entry("donor/secondary", EntryKind::Component, Some("donor")),
        entry("receiver", EntryKind::Component, None),
    ];
    let mut after = vec![
        before[0].clone(),
        before[4].clone(),
        entry("receiver/primary", EntryKind::Component, Some("receiver")),
    ];
    if keep_donor {
        after.extend([before[1].clone(), before[3].clone()]);
    }
    let donor_state = if keep_donor {
        ReviewState::Unchanged
    } else {
        ReviewState::Removed
    };
    let mut variant = classified(
        "receiver/primary",
        EntryKind::Component,
        ReviewState::Unchanged,
    );
    variant.previous_path = Some("donor/primary".into());
    variant.documents[0].before_route = Some("donor/primary/index.desktop.html".into());
    paired_result(
        before,
        after,
        vec![
            classified("badge", EntryKind::Component, ReviewState::Changed),
            classified("donor", EntryKind::Component, donor_state),
            classified("donor/secondary", EntryKind::Component, donor_state),
            classified("receiver", EntryKind::Component, ReviewState::Unchanged),
            variant,
        ],
        Pairing {
            entries: [
                Some(0),
                keep_donor.then_some(3),
                Some(2),
                keep_donor.then_some(4),
                Some(1),
            ]
            .into_iter()
            .enumerate()
            .map(|(before, after)| EntryPair {
                before: Some(before),
                after,
                moved: before == 2,
            })
            .collect(),
            moves: vec![MovePair {
                kind: EntryKind::Component,
                path: "receiver/primary".into(),
                previous_path: "donor/primary".into(),
            }],
            diagnostics: vec![],
        },
    )
}
