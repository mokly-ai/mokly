//! Retained Rust usage accounting avoids JSON depth limits and temporary encodings.

use std::mem;

use mokly_model::usage::{
    CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord, ComponentRangeRecord,
    ComponentRangeTarget, ComponentSlotRecord,
};
use mokly_model::wire_props::ComponentWireValue;

use crate::export_memory::{ExportBuffer, ExportObserver, Observation};

/// Heap bytes of the logical owner, excluding its containing record.
pub(crate) fn owner(owner: &ComponentInputOwner) -> usize {
    match owner {
        ComponentInputOwner::Entry => 0,
        ComponentInputOwner::Instance { instance_key } => instance_key.capacity(),
    }
}

/// Conservative heap charge of complete usage, including nested wire props.
pub(crate) fn usage_observed(
    usage: &CatalogueUsage,
    observer: Option<&dyn ExportObserver>,
) -> usize {
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = usage
    else {
        return 0;
    };
    let mut bytes = instance_records(instances, observer)
        + slot_records(slots)
        + ranges.capacity() * mem::size_of::<ComponentRangeRecord>();
    for range in ranges {
        bytes += range.id.capacity() + range.parent_id.as_ref().map_or(0, String::capacity);
        bytes += match &range.target {
            ComponentRangeTarget::Instance { instance_key } => instance_key.capacity(),
            ComponentRangeTarget::Slot { slot_key } => slot_key.capacity(),
            ComponentRangeTarget::Root => 0,
        };
    }
    bytes
}

pub(crate) fn instance_records(
    instances: &Vec<ComponentInstanceRecord>,
    observer: Option<&dyn ExportObserver>,
) -> usize {
    let mut bytes = instances.capacity() * mem::size_of::<ComponentInstanceRecord>();
    for instance in instances {
        bytes += instance.key.capacity()
            + instance.id.capacity()
            + instance.component_id.capacity()
            + owner(&instance.owner)
            + instance.slot_key.as_ref().map_or(0, String::capacity)
            + instance.props_key.capacity();
        if let Some(source) = &instance.source {
            bytes += source.path.capacity();
        }
        for (key, value) in &instance.props {
            bytes += 256 + key.capacity() + mem::size_of_val(value) + wire(value, observer);
        }
    }
    bytes
}

pub(crate) fn slot_records(slots: &Vec<ComponentSlotRecord>) -> usize {
    let mut bytes = slots.capacity() * mem::size_of::<ComponentSlotRecord>();
    for slot in slots {
        bytes += slot.key.capacity()
            + slot.instance_key.capacity()
            + slot.name.capacity()
            + owner(&slot.owner)
            + slot.source_slot_key.as_ref().map_or(0, String::capacity);
    }
    bytes
}

fn wire(value: &ComponentWireValue, observer: Option<&dyn ExportObserver>) -> usize {
    let memory = Observation::new(observer, ExportBuffer::Accounting);
    let mut pending = vec![value];
    let mut bytes = 0;
    while let Some(value) = pending.pop() {
        memory.set(pending.capacity() * mem::size_of::<&ComponentWireValue>());
        match value {
            ComponentWireValue::Null(_) | ComponentWireValue::Boolean(_, _) => {}
            ComponentWireValue::Number(_, text) | ComponentWireValue::String(_, text) => {
                bytes += text.capacity()
            }
            ComponentWireValue::Array(_, items) => {
                bytes += items.capacity() * mem::size_of::<ComponentWireValue>();
                pending.extend(items);
            }
            ComponentWireValue::Object(_, items) => {
                bytes += items.capacity() * mem::size_of::<(String, ComponentWireValue)>();
                for (key, value) in items {
                    bytes += key.capacity();
                    pending.push(value);
                }
            }
        }
    }
    memory.set(pending.capacity() * mem::size_of::<&ComponentWireValue>());
    bytes
}
