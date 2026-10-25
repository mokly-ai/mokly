//! A variant's nested use of its own component is a real consumer.

use std::collections::BTreeMap;

use serde::Deserialize;

use crate::projection_usage;
use crate::public_detail::EntryDetailV2;
use crate::readers;
use crate::usage::{CatalogueUsage, ComponentInputOwner, ComponentInstanceRecord};

#[derive(Deserialize)]
struct Fixtures {
    current: BTreeMap<String, EntryDetailV2>,
}

#[test]
fn variant_slot_self_use_is_retained_and_its_child_is_transitive() {
    let index = readers::index(include_str!(
        "../../../../docs/protocol/fixtures/catalogue-v7.json"
    ))
    .unwrap();
    let mut details: Fixtures = serde_json::from_str(include_str!(
        "../../../../docs/protocol/fixtures/entry-details-v2.json"
    ))
    .unwrap();
    let variant = details
        .current
        .get_mut("components/action/default")
        .unwrap();
    let instance = ComponentInstanceRecord {
        key: "a".repeat(64),
        id: "nested-action".into(),
        component_id: "components/action".into(),
        owner: ComponentInputOwner::Entry,
        slot_key: Some("c".repeat(64)),
        order: 0,
        props: Default::default(),
        props_key: "d".repeat(64),
        source: None,
    };
    let child = ComponentInstanceRecord {
        key: "b".repeat(64),
        id: "child".into(),
        owner: ComponentInputOwner::Instance {
            instance_key: instance.key.clone(),
        },
        slot_key: None,
        ..instance.clone()
    };
    variant.views[0].usage = CatalogueUsage::Ready {
        instances: vec![instance, child],
        slots: Vec::new(),
        ranges: Vec::new(),
    };
    let borrowed = details
        .current
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    let workspaces = projection_usage::workspaces(&borrowed, &index);
    for path in ["components/action", "components/action/default"] {
        let links = &workspaces[path].used_by;
        assert_eq!(links.len(), 2);
        assert!(
            links
                .iter()
                .all(|link| link.entry_path == "components/action/default")
        );
        assert_eq!(links[0].instance_key, "a".repeat(64));
        assert!(links[0].direct);
        assert_eq!(links[1].instance_key, "b".repeat(64));
        assert!(!links[1].direct);
    }
    details
        .current
        .get_mut("product/browse/home")
        .unwrap()
        .views[0]
        .usage = CatalogueUsage::Unavailable;
    let borrowed = details
        .current
        .iter()
        .map(|(path, detail)| (path.clone(), detail))
        .collect();
    assert!(projection_usage::workspaces(&borrowed, &index).is_empty());
}
