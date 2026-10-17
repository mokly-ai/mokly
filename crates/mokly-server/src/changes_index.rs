//! Pure Changes membership and per-view eligibility projection.

use std::collections::BTreeMap;

use mokly_compare::comparison_types::EntryClassification;
use mokly_model::namespace::viewer;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::{
    CatalogueChanges, CatalogueEntry, ChangeKind, ChangesStatus, ComparisonSelection,
};
use mokly_model::public_records::CatalogueVisual;
use mokly_model::review::{EntryChangeReason, ReviewState};

use crate::changes::Accepted;

pub(crate) fn kind(state: ReviewState) -> ChangeKind {
    match state {
        ReviewState::Added => ChangeKind::Added,
        ReviewState::Removed => ChangeKind::Removed,
        ReviewState::Changed => ChangeKind::Changed,
        ReviewState::Unchanged | ReviewState::IgnoredOnly => ChangeKind::Unmodified,
    }
}

pub(crate) fn eligible(state: ReviewState) -> bool {
    matches!(
        state,
        ReviewState::Added | ReviewState::Removed | ReviewState::Changed
    )
}

pub(crate) fn apply(
    index: &mut CatalogueReadModel,
    status: ChangesStatus,
    accepted: Option<&Accepted>,
) {
    index.changes_status = status;
    index.comparison_url =
        accepted.map(|accepted| viewer(&format!("diffs/generations/{}/review.json", accepted.id)));
    index.removed_entries.clear();
    let entries: BTreeMap<_, _> = accepted
        .into_iter()
        .flat_map(|accepted| &accepted.result.entries)
        .map(|entry| (entry.path.as_str(), entry))
        .collect();
    for entry in &mut index.screens {
        let classification = entries.get(entry.entry.path.as_str()).copied();
        common(&mut entry.entry, status, classification);
        visual(&mut entry.visual, status, classification);
    }
    for entry in &mut index.components {
        let classification = entries.get(entry.entry.path.as_str()).copied();
        common(&mut entry.entry, status, classification);
        visual(&mut entry.visual, status, classification);
        entry.comparison = match (status, classification) {
            (ChangesStatus::Ready, Some(entry)) => ComparisonSelection::Ready {
                kind: entry_kind(entry),
                eligible: entry
                    .documents
                    .iter()
                    .any(|document| eligible(document.state)),
            },
            _ => selection(status, None),
        };
    }
    for entry in index
        .pages
        .iter_mut()
        .map(|entry| &mut entry.entry)
        .chain(index.documents.iter_mut().map(|entry| &mut entry.entry))
        .chain(index.use_cases.iter_mut().map(|entry| &mut entry.entry))
    {
        let classification = entries.get(entry.path.as_str()).copied();
        common(entry, status, classification);
    }
}

pub(crate) fn common(
    entry: &mut CatalogueEntry,
    status: ChangesStatus,
    classification: Option<&EntryClassification>,
) {
    entry.previous_path = classification.and_then(|entry| entry.previous_path.clone());
    entry.changes = match (status, classification) {
        (ChangesStatus::Ready, Some(classification)) => CatalogueChanges::Ready {
            kind: entry_kind(classification),
            included: classification.included,
        },
        (ChangesStatus::Preparing, _) => CatalogueChanges::Preparing,
        (ChangesStatus::Pending, _) => CatalogueChanges::Pending,
        (ChangesStatus::Disabled, _) => CatalogueChanges::Disabled,
        _ => CatalogueChanges::Unavailable,
    };
}

pub(crate) fn visual(
    visual: &mut CatalogueVisual,
    status: ChangesStatus,
    classification: Option<&EntryClassification>,
) {
    for view in &mut visual.views {
        let state = classification
            .and_then(|entry| {
                entry.documents.iter().find(|document| {
                    document.key.viewport == Some(view.viewport)
                        && document.key.color_scheme == view.color_scheme
                })
            })
            .map(|document| document.state);
        view.comparison = selection(status, state);
    }
}

fn selection(status: ChangesStatus, state: Option<ReviewState>) -> ComparisonSelection {
    match (status, state) {
        (ChangesStatus::Ready, Some(state)) => ComparisonSelection::Ready {
            kind: kind(state),
            eligible: eligible(state),
        },
        (ChangesStatus::Preparing, _) => ComparisonSelection::Preparing,
        (ChangesStatus::Pending, _) => ComparisonSelection::Pending,
        (ChangesStatus::Disabled, _) => ComparisonSelection::Disabled,
        _ => ComparisonSelection::Unavailable,
    }
}

fn entry_kind(entry: &EntryClassification) -> ChangeKind {
    if entry.reasons.contains(&EntryChangeReason::Added) {
        ChangeKind::Added
    } else if entry.reasons.contains(&EntryChangeReason::Removed) {
        ChangeKind::Removed
    } else if !entry.reasons.is_empty() || eligible(entry.state) {
        ChangeKind::Changed
    } else {
        ChangeKind::Unmodified
    }
}

#[cfg(test)]
#[path = "_tests_/changes_index_tests.rs"]
mod changes_index_tests;
