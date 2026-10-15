//! Review-local reference checks complement the producer's actual instance ownership proof.

use std::collections::BTreeSet;

use crate::canonical;
use crate::review::{ReviewEntry, ReviewKind, ReviewState};
use crate::review_affected::{AffectedConsumer, ConsumerKind, ReviewSide};

pub(crate) fn valid(affected: &AffectedConsumer, entries: &[&ReviewEntry]) -> bool {
    if affected.consumer.kind == ConsumerKind::Component
        && affected.consumer.path == affected.changed_component_id
    {
        return false;
    }
    if !entries.iter().any(|entry| {
        kind(entry.kind) == Some(affected.consumer.kind) && entry.path == affected.consumer.path
    }) {
        return false;
    }
    for evidence in &affected.evidence {
        let context = entries.iter().find_map(|entry| {
            if kind(entry.kind) != Some(evidence.context.kind) {
                return None;
            }
            let side = match evidence.side {
                ReviewSide::Before => entry.before.as_ref(),
                ReviewSide::After => entry.after.as_ref(),
            }?;
            (side.path == evidence.context.entry.path).then_some((*entry, side))
        });
        let Some((entry, address)) = context else {
            return false;
        };
        if canonical::to_string(address).ok() != canonical::to_string(&evidence.context.entry).ok()
        {
            return false;
        }
        if !entry.views.iter().any(|view| {
            view.viewport == evidence.context.viewport
                && view.color_scheme == evidence.context.color_scheme
                && match evidence.side {
                    ReviewSide::Before => view.state != ReviewState::Added,
                    ReviewSide::After => view.state != ReviewState::Removed,
                }
        }) {
            return false;
        }
        let Some(last) = evidence.via.last() else {
            return false;
        };
        let resolved = if evidence.side == ReviewSide::Before {
            entries
                .iter()
                .find(|entry| {
                    entry.kind == ReviewKind::Component
                        && entry.before.as_ref().is_some_and(|address| {
                            address.path.eq_ignore_ascii_case(&last.component_id)
                        })
                })
                .map(|entry| entry.path.as_str())
        } else {
            Some(last.component_id.as_str())
        };
        if resolved != Some(affected.changed_component_id.as_str()) {
            return false;
        }
        let mut keys = BTreeSet::new();
        if evidence
            .via
            .iter()
            .any(|edge| !keys.insert(&edge.instance_key))
        {
            return false;
        }
    }
    true
}

fn kind(kind: ReviewKind) -> Option<ConsumerKind> {
    match kind {
        ReviewKind::Component => Some(ConsumerKind::Component),
        ReviewKind::Screen => Some(ConsumerKind::Screen),
        ReviewKind::UseCase => None,
    }
}
