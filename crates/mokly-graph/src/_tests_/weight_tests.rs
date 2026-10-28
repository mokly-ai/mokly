//! Usage, instance, and slot records add twice their JSON length to the charge.

use std::collections::BTreeMap;

use mokly_html::composition::Composed;
use mokly_html::fragment::Fragment;
use mokly_model::usage::{
    CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord, ComponentSlotRecord,
};
use mokly_model::wire_props::{ComponentWireValue, StringTag};

use super::{document, fragment};

fn instance() -> ComponentInstanceRecord {
    ComponentInstanceRecord {
        key: "a".repeat(64),
        id: "card".into(),
        component_id: "example/components/card".into(),
        owner: ComponentInputOwner::Entry,
        slot_key: None,
        order: 0,
        props: BTreeMap::from([(
            "title".into(),
            ComponentWireValue::String(StringTag::Value, "Welcome".into()),
        )]),
        props_key: "b".repeat(64),
        source: None,
    }
}

fn slot() -> ComponentSlotRecord {
    ComponentSlotRecord {
        key: "c".repeat(64),
        instance_key: "a".repeat(64),
        name: "body".into(),
        owner: ComponentInputOwner::Entry,
        source_slot_key: None,
    }
}

fn composed(usage: CatalogueUsage) -> Composed {
    Composed {
        tree: Vec::new(),
        usage,
        warnings: Vec::new(),
        resources: Vec::new(),
        components: Vec::new(),
        links: Vec::new(),
    }
}

#[test]
fn document_usage_records_add_twice_their_json_length() {
    let empty = CatalogueUsage::Ready {
        instances: Vec::new(),
        slots: Vec::new(),
        ranges: Vec::new(),
    };
    let full = CatalogueUsage::Ready {
        instances: vec![instance(), instance()],
        slots: vec![slot()],
        ranges: Vec::new(),
    };
    let added =
        serde_json::to_vec(&full).unwrap().len() - serde_json::to_vec(&empty).unwrap().len();
    assert!(added > 0);
    assert_eq!(
        document(&composed(full)) - document(&composed(empty)),
        2 * added
    );
}

#[test]
fn fragment_instance_and_slot_records_add_twice_their_json_length() {
    let empty = Fragment::default();
    let full = Fragment {
        instances: vec![instance()],
        slots: vec![slot(), slot()],
        ..Fragment::default()
    };
    let added = serde_json::to_vec(&full.instances).unwrap().len()
        - serde_json::to_vec(&empty.instances).unwrap().len()
        + serde_json::to_vec(&full.slots).unwrap().len()
        - serde_json::to_vec(&empty.slots).unwrap().len();
    assert!(added > 0);
    assert_eq!(fragment(&full) - fragment(&empty), 2 * added);
}
