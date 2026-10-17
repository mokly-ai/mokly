//! Canonical supplied-slot inputs retain forwarding choices without physical placement ids.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::usage::{CatalogueUsage, ComponentInputOwner};
use serde::Serialize;

/// Logical slot inputs of every instance in one composed view.
pub(crate) type SlotInputs = BTreeMap<String, Vec<SlotSignal>>;

/// Forwarding normalizes to the original supplier and its logical receiving slot.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct SlotSignal {
    name: String,
    source: String,
    owner: ComponentInputOwner,
}

pub(crate) fn collect(usage: &CatalogueUsage) -> SlotInputs {
    let CatalogueUsage::Ready { slots, .. } = usage else {
        return BTreeMap::new();
    };
    let index: BTreeMap<_, _> = slots.iter().map(|slot| (slot.key.as_str(), slot)).collect();
    let mut output: SlotInputs = BTreeMap::new();
    for slot in slots {
        let mut origin = slot;
        let mut seen = BTreeSet::new();
        while let Some(source) = &origin.source_slot_key {
            if !seen.insert(source) {
                break;
            }
            let Some(next) = index.get(source.as_str()) else {
                break;
            };
            origin = next;
        }
        output
            .entry(slot.instance_key.clone())
            .or_default()
            .push(SlotSignal {
                name: slot.name.clone(),
                source: origin.key.clone(),
                owner: origin.owner.clone(),
            });
    }
    for signals in output.values_mut() {
        signals.sort_by(|left, right| left.name.cmp(&right.name));
    }
    output
}
