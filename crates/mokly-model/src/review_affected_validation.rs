//! Review-local reference checks complement the producer's actual instance ownership proof.

use std::collections::{BTreeMap, BTreeSet};

use crate::canonical;
use crate::review::{ReviewEntry, ReviewEntryAddress, ReviewKind, ReviewState};
use crate::review_affected::{AffectedConsumer, ConsumerKind, ReviewSide};

pub(crate) struct Index<'a> {
    current: BTreeSet<(ConsumerKind, &'a str)>,
    sides: BTreeMap<(ReviewSide, ConsumerKind, &'a str), (&'a ReviewEntry, &'a ReviewEntryAddress)>,
    before_components: BTreeMap<String, &'a str>,
}

impl<'a> Index<'a> {
    pub(crate) fn new(entries: &[&'a ReviewEntry]) -> Self {
        let mut index = Self {
            current: BTreeSet::new(),
            sides: BTreeMap::new(),
            before_components: BTreeMap::new(),
        };
        for entry in entries {
            let Some(kind) = kind(entry.kind) else {
                continue;
            };
            index.current.insert((kind, &entry.path));
            for (side, address) in [
                (ReviewSide::Before, &entry.before),
                (ReviewSide::After, &entry.after),
            ] {
                if let Some(address) = address {
                    index
                        .sides
                        .insert((side, kind, &address.path), (entry, address));
                    if side == ReviewSide::Before && kind == ConsumerKind::Component {
                        index
                            .before_components
                            .insert(address.path.to_ascii_lowercase(), &entry.path);
                    }
                }
            }
        }
        index
    }
}

pub(crate) fn valid(affected: &AffectedConsumer, index: &Index<'_>) -> bool {
    if affected.consumer.kind == ConsumerKind::Component
        && affected.consumer.path == affected.changed_component_id
    {
        return false;
    }
    if !index
        .current
        .contains(&(affected.consumer.kind, affected.consumer.path.as_str()))
    {
        return false;
    }
    for evidence in &affected.evidence {
        let context = index.sides.get(&(
            evidence.side,
            evidence.context.kind,
            evidence.context.entry.path.as_str(),
        ));
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
            index
                .before_components
                .get(&last.component_id.to_ascii_lowercase())
                .copied()
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
