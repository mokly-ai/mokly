//! Material digest, schema, graph, source, order, and physical root rejection.

use crate::axes::EntryKind;
use crate::material;
use crate::readers;
use crate::usage::{
    CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord, ComponentRangeRecord,
    ComponentRangeTarget,
};
use crate::wire_decode;

use super::validate;

fn fixture() -> (
    CatalogueUsage,
    Vec<crate::public_records::CatalogueComponent>,
) {
    let index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    let component = &index.components[0];
    let props = wire_decode::decode(&component.visual.props).unwrap();
    let key = material::instance_key(&ComponentInputOwner::Entry, None, "action").unwrap();
    let usage = CatalogueUsage::Ready {
        instances: vec![ComponentInstanceRecord {
            key: key.clone(),
            id: "action".into(),
            component_id: component.entry.path.clone(),
            owner: ComponentInputOwner::Entry,
            slot_key: None,
            order: 0,
            props: component.visual.props.clone(),
            props_key: material::props_key(&props).unwrap(),
            source: None,
        }],
        slots: vec![],
        ranges: vec![ComponentRangeRecord {
            id: "r-0".into(),
            target: ComponentRangeTarget::Instance { instance_key: key },
            parent_id: None,
        }],
    };
    (usage, index.components)
}

#[test]
fn recorded_material_requires_matching_keys_schema_and_complete_regions() {
    let (usage, components) = fixture();
    validate(&usage, EntryKind::Screen, &components).unwrap();
    for mutation in 0..9 {
        let mut candidate = usage.clone();
        let CatalogueUsage::Ready {
            instances, ranges, ..
        } = &mut candidate
        else {
            unreachable!()
        };
        match mutation {
            0 => instances[0].key = "0".repeat(64),
            1 => instances[0].props_key = "0".repeat(64),
            2 => instances[0].props.clear(),
            3 => instances[0].order = 1,
            4 => instances[0].component_id = "absent".into(),
            5 => {
                instances[0].source = Some(crate::usage::ComponentSourceLocation {
                    path: "../escape".into(),
                    line: 1,
                    column: 1,
                })
            }
            6 => instances.push(instances[0].clone()),
            7 => ranges.clear(),
            _ => ranges[0].parent_id = Some("r-0".into()),
        }
        assert!(
            validate(&candidate, EntryKind::Screen, &components).is_err(),
            "mutation {mutation}"
        );
    }
    assert!(validate(&usage, EntryKind::Component, &components).is_err());
}

#[test]
fn slot_forwarding_cycles_and_missing_input_owners_are_rejected() {
    let (mut usage, mut components) = fixture();
    components[0].slots = vec!["content".into()];
    let CatalogueUsage::Ready {
        instances,
        slots,
        ranges,
    } = &mut usage
    else {
        unreachable!()
    };
    let mut second = instances[0].clone();
    second.id = "second".into();
    second.key = material::instance_key(&second.owner, None, &second.id).unwrap();
    second.order = 1;
    ranges.push(ComponentRangeRecord {
        id: "r-1".into(),
        target: ComponentRangeTarget::Instance {
            instance_key: second.key.clone(),
        },
        parent_id: None,
    });
    instances.push(second);
    let first_slot = material::slot_key(&instances[0].key, "content").unwrap();
    let second_slot = material::slot_key(&instances[1].key, "content").unwrap();
    for (instance, key, earlier) in [
        (&instances[0], &first_slot, &second_slot),
        (&instances[1], &second_slot, &first_slot),
    ] {
        slots.push(crate::usage::ComponentSlotRecord {
            key: key.clone(),
            instance_key: instance.key.clone(),
            name: "content".into(),
            owner: ComponentInputOwner::Entry,
            source_slot_key: Some(earlier.clone()),
        });
    }
    instances.sort_by(|a, b| a.key.cmp(&b.key));
    slots.sort_by(|a, b| a.key.cmp(&b.key));
    assert!(matches!(
        validate(&usage, EntryKind::Screen, &components),
        Err(crate::readers::ReadError::Contract {
            message: crate::read_contract::ContractViolation::UsageCycle,
            ..
        })
    ));
    let (mut usage, components) = fixture();
    let CatalogueUsage::Ready {
        instances, ranges, ..
    } = &mut usage
    else {
        unreachable!()
    };
    instances[0].owner = ComponentInputOwner::Instance {
        instance_key: "d".repeat(64),
    };
    instances[0].key = material::instance_key(&instances[0].owner, None, &instances[0].id).unwrap();
    ranges[0].target = ComponentRangeTarget::Instance {
        instance_key: instances[0].key.clone(),
    };
    assert!(matches!(
        validate(&usage, EntryKind::Screen, &components),
        Err(crate::readers::ReadError::Contract {
            message: crate::read_contract::ContractViolation::UsageReference,
            ..
        })
    ));
}
