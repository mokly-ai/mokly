//! Exact visible metadata capacities exclude opaque BTree node allocations.

use std::mem;

use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_model::usage::{
    ComponentInstanceRecord, ComponentRangeRecord, ComponentRangeTarget, ComponentSlotRecord,
};
use mokly_model::wire_props::ComponentWireValue;

use crate::document_annotations::ReferenceRecord;
use crate::document_usage;

pub(crate) fn strings(values: &Vec<String>) -> usize {
    values.capacity() * mem::size_of::<String>()
        + values.iter().map(String::capacity).sum::<usize>()
}

pub(crate) fn links(values: &Vec<ReferenceRecord>) -> usize {
    values.capacity() * mem::size_of::<ReferenceRecord>()
        + values
            .iter()
            .map(ReferenceRecord::known_bytes)
            .sum::<usize>()
}

pub(crate) fn warnings(values: &Vec<Warning>) -> usize {
    values.capacity() * mem::size_of::<Warning>()
        + values
            .iter()
            .map(|warning| {
                warning.message.capacity()
                    + match &warning.subject {
                        WarningSubject::Route(value)
                        | WarningSubject::Entry(value)
                        | WarningSubject::Component(value)
                        | WarningSubject::Folder(value)
                        | WarningSubject::Configuration(value) => value.capacity(),
                    }
            })
            .sum::<usize>()
}

pub(crate) fn usage(
    instances: &Vec<ComponentInstanceRecord>,
    slots: &Vec<ComponentSlotRecord>,
    ranges: &Vec<ComponentRangeRecord>,
) -> (usize, usize) {
    let mut bytes = instances.capacity() * mem::size_of::<ComponentInstanceRecord>()
        + slots.capacity() * mem::size_of::<ComponentSlotRecord>()
        + ranges.capacity() * mem::size_of::<ComponentRangeRecord>();
    let mut charge = 0;
    for instance in instances {
        bytes += instance.key.capacity()
            + instance.id.capacity()
            + instance.component_id.capacity()
            + document_usage::owner(&instance.owner)
            + instance.slot_key.as_ref().map_or(0, String::capacity)
            + instance.props_key.capacity()
            + instance
                .source
                .as_ref()
                .map_or(0, |source| source.path.capacity());
        for (key, value) in &instance.props {
            bytes += key.capacity() + wire(value);
            charge += 256;
        }
    }
    for slot in slots {
        bytes += slot.key.capacity()
            + slot.instance_key.capacity()
            + slot.name.capacity()
            + document_usage::owner(&slot.owner)
            + slot.source_slot_key.as_ref().map_or(0, String::capacity);
    }
    for range in ranges {
        bytes += range.id.capacity()
            + range.parent_id.as_ref().map_or(0, String::capacity)
            + match &range.target {
                ComponentRangeTarget::Root => 0,
                ComponentRangeTarget::Instance { instance_key } => instance_key.capacity(),
                ComponentRangeTarget::Slot { slot_key } => slot_key.capacity(),
            };
    }
    (bytes, charge)
}

fn wire(value: &ComponentWireValue) -> usize {
    match value {
        ComponentWireValue::Null(_) | ComponentWireValue::Boolean(_, _) => 0,
        ComponentWireValue::Number(_, text) | ComponentWireValue::String(_, text) => {
            text.capacity()
        }
        ComponentWireValue::Array(_, items) => {
            items.capacity() * mem::size_of::<ComponentWireValue>()
                + items.iter().map(wire).sum::<usize>()
        }
        ComponentWireValue::Object(_, items) => {
            items.capacity() * mem::size_of::<(String, ComponentWireValue)>()
                + items
                    .iter()
                    .map(|(key, value)| key.capacity() + wire(value))
                    .sum::<usize>()
        }
    }
}
