//! Deep lazy suppliers and repaired ownership do not consume the call stack.

use std::collections::BTreeMap;
use std::sync::Arc;
use std::thread;

use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::{ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord};

use crate::context::{Context, Slot};
use crate::normalized_keys::Keys;

fn context() -> Context {
    Context {
        raw_text: false,
        link_base: String::new(),
        replay: false,
        props: BTreeMap::new(),
        schema: Default::default(),
        source: SourceLocation {
            path: "test.html".into(),
            line: 1,
            column: 1,
            export: None,
        },
        owner: ComponentInputOwner::Entry,
        slot_key: None,
        ignore: false,
        slots: BTreeMap::new(),
        declared_slots: vec![],
    }
}

#[test]
fn deep_lazy_slot_suppliers_drop_with_shared_ancestors() {
    thread::spawn(|| {
        let bottom = Arc::new(context());
        let mut supplier = bottom.clone();
        for _ in 0..100_000 {
            let mut next = context();
            next.slots.insert(
                "children".into(),
                Slot {
                    nodes: Arc::new(vec![]),
                    supplier,
                    origin_key: None,
                    key: None,
                    instance_key: None,
                },
            );
            supplier = Arc::new(next);
        }
        let shared = supplier.clone();
        drop(supplier);
        assert_eq!(Arc::strong_count(&bottom), 2);
        drop(shared);
        assert_eq!(Arc::strong_count(&bottom), 1);
    })
    .join()
    .unwrap();
}

#[test]
fn deep_owner_and_slot_dependencies_resolve_from_the_leaf() {
    thread::spawn(|| {
        let mut instances = BTreeMap::new();
        let mut slots = BTreeMap::new();
        for index in 0..100_000 {
            let key = index.to_string();
            let parent = (index - 1).to_string();
            let slot = format!("slot-{parent}");
            let owner = if index == 0 {
                ComponentInputOwner::Entry
            } else {
                ComponentInputOwner::Instance {
                    instance_key: parent.clone(),
                }
            };
            if index > 0 {
                slots.insert(
                    slot.clone(),
                    ComponentSlotRecord {
                        key: slot.clone(),
                        instance_key: parent,
                        name: "children".into(),
                        owner: ComponentInputOwner::Entry,
                        source_slot_key: None,
                    },
                );
            }
            instances.insert(
                key.clone(),
                ComponentInstanceRecord {
                    key,
                    id: "nested".into(),
                    component_id: "panel".into(),
                    owner,
                    slot_key: (index > 0).then_some(slot),
                    order: 0,
                    props: BTreeMap::new(),
                    props_key: "props".into(),
                    source: None,
                },
            );
        }
        let mut keys = Keys::new(&instances, &slots, instances.keys().cloned().collect());
        let leaf = keys.instance("99999").unwrap().unwrap();
        assert_ne!(leaf, "99999");
        assert_eq!(keys.instance("99999").unwrap().as_ref(), Some(&leaf));
        assert!(keys.slot("slot-99998").unwrap().is_some());
    })
    .join()
    .unwrap();
}
