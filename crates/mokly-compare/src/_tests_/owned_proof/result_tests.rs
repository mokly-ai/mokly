//! Compact state preserves complete proof values and their original order.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::usage::ComponentInputOwner;

use super::support::{compare, document, expected, hit, instance, own_pages, record, slot};

#[test]
fn nested_owner_copies_preserve_both_proofs_in_pair_order_after_a_move() {
    let nodes = |path| {
        vec![instance(
            path,
            "z-outer",
            vec![instance(path, "a-inner", vec![hit(), hit()])],
        )]
    };
    let mut changes = compare(
        &document(nodes("old"), "red", "old"),
        &document(nodes("owner"), "blue", "owner"),
        &BTreeMap::from([("old".into(), "owner".into())]),
    );
    let proofs: Vec<_> = changes
        .proofs(&BTreeMap::new())
        .into_iter()
        .map(record)
        .collect();
    assert_eq!(
        proofs,
        [expected("owner", "a-inner"), expected("owner", "z-outer")]
    );
}

#[test]
fn a_receivers_own_page_match_does_not_block_a_different_slot_supplier() {
    let nodes = || {
        vec![instance(
            "owner",
            "supplier",
            vec![instance(
                "other",
                "receiver",
                vec![slot(
                    "receiver",
                    ComponentInputOwner::Instance {
                        instance_key: "supplier".into(),
                    },
                    vec![hit()],
                )],
            )],
        )]
    };
    let mut changes = compare(
        &document(nodes(), "red", "owner"),
        &document(nodes(), "blue", "owner"),
        &BTreeMap::new(),
    );
    let identity = changes.rules[0].identity.clone();
    let pages = own_pages("other");
    assert_eq!(
        pages.get(&identity),
        Some(&BTreeSet::from(["other".into()]))
    );
    let proofs: Vec<_> = changes.proofs(&pages).into_iter().map(record).collect();
    assert_eq!(proofs, [expected("owner", "supplier")]);
}

#[test]
fn another_components_own_page_match_blocks_the_outer_owner() {
    let nodes = || {
        vec![instance(
            "owner",
            "outer",
            vec![instance("other", "inner", vec![hit()])],
        )]
    };
    let before = document(nodes(), "red", "owner");
    let after = document(nodes(), "blue", "owner");
    let mut changes = compare(&before, &after, &BTreeMap::new());
    let identity = changes.rules[0].identity.clone();
    let pages = own_pages("other");
    assert_eq!(
        pages.get(&identity),
        Some(&BTreeSet::from(["other".into()]))
    );
    assert!(changes.proofs(&pages).is_empty());
    let proofs: Vec<_> = compare(&before, &after, &BTreeMap::new())
        .proofs(&BTreeMap::new())
        .into_iter()
        .map(record)
        .collect();
    assert_eq!(proofs, [expected("owner", "outer")]);
}

#[test]
fn a_blocked_chain_keeps_the_inner_owner_copy() {
    let nodes = || {
        vec![instance(
            "owner",
            "outer",
            vec![instance(
                "other",
                "middle",
                vec![instance("owner", "inner", vec![hit()])],
            )],
        )]
    };
    let mut changes = compare(
        &document(nodes(), "red", "owner"),
        &document(nodes(), "blue", "owner"),
        &BTreeMap::new(),
    );
    let identity = changes.rules[0].identity.clone();
    let pages = own_pages("other");
    assert_eq!(
        pages.get(&identity),
        Some(&BTreeSet::from(["other".into()]))
    );
    let proofs: Vec<_> = changes.proofs(&pages).into_iter().map(record).collect();
    assert_eq!(proofs, [expected("owner", "inner")]);
}
