//! Unmatched document elements and instances do not increase retained proof state.

use std::collections::BTreeMap;

use mokly_html::tree;
use mokly_model::usage::ComponentInputOwner;

use crate::owned_styles::Changes;

use super::support::{
    compare, compare_views, document, expected, hit, instance, instance_with_props, record, slot,
};

fn catalogue_view(elements: usize, matching: bool) -> Changes {
    let nodes = || {
        let mut nodes = vec![
            instance("owner", "second", vec![hit(), hit()]),
            instance("owner", "first", vec![hit()]),
        ];
        nodes.extend((3..elements - 1).map(|index| {
            instance(
                "unrelated",
                &format!("unrelated-{index}"),
                vec![if matching {
                    hit()
                } else {
                    tree::element("p", &[], vec![])
                }],
            )
        }));
        nodes
    };
    compare(
        &document(nodes(), "red", "owner"),
        &document(nodes(), "blue", "owner"),
        &BTreeMap::new(),
    )
}

#[test]
fn retained_owned_state_is_equal_at_one_and_four_catalogue_sizes() {
    for matching in [false, true] {
        let mut small = catalogue_view(32, matching);
        let mut large = catalogue_view(128, matching);
        assert_eq!(small.retained_counts(), large.retained_counts());
        assert_eq!(small.retained_counts(), (4, 4, 2));
        let small: Vec<_> = small
            .proofs(&BTreeMap::new())
            .into_iter()
            .map(record)
            .collect();
        let large: Vec<_> = large
            .proofs(&BTreeMap::new())
            .into_iter()
            .map(record)
            .collect();
        assert_eq!(small, large);
        assert_eq!(
            small,
            [expected("owner", "first"), expected("owner", "second")]
        );
    }
}

#[test]
fn added_and_removed_views_retain_no_owned_proof_chains() {
    let document = document(
        vec![instance("owner", "owner", vec![hit()])],
        "red",
        "owner",
    );
    let mut views = [
        compare_views(None, Some(&document), &BTreeMap::new()),
        compare_views(Some(&document), None, &BTreeMap::new()),
    ];
    assert_eq!(
        views.each_ref().map(Changes::retained_counts),
        [(0, 0, 0), (0, 0, 0)]
    );
    for view in &mut views {
        assert!(view.proofs(&BTreeMap::new()).is_empty());
    }
}

#[test]
fn unpaired_and_changed_input_owners_retain_only_the_eligible_chain() {
    let before = document(
        vec![
            instance("owner", "kept", vec![hit()]),
            instance_with_props("owner", "changed", "before", vec![hit()]),
            instance("owner", "removed", vec![hit()]),
        ],
        "red",
        "owner",
    );
    let after = document(
        vec![
            instance("owner", "kept", vec![hit()]),
            instance_with_props("owner", "changed", "after", vec![hit()]),
            instance("owner", "added", vec![hit()]),
        ],
        "blue",
        "owner",
    );
    let mut changes = compare(&before, &after, &BTreeMap::new());
    assert_eq!(changes.retained_counts(), (2, 2, 1));
    let proofs: Vec<_> = changes
        .proofs(&BTreeMap::new())
        .into_iter()
        .map(record)
        .collect();
    assert_eq!(proofs, [expected("owner", "kept")]);
}

#[test]
fn input_only_instances_do_not_retain_their_physical_ancestors() {
    for depth in [16, 64] {
        let nodes = || {
            let mut supplier = slot(
                "unused",
                ComponentInputOwner::Entry,
                vec![instance("supplier", "supplier", vec![])],
            );
            for index in 0..depth {
                supplier = instance("unused", &format!("unused-{index}"), vec![supplier]);
            }
            vec![
                supplier,
                instance(
                    "owner",
                    "receiver",
                    vec![slot(
                        "receiver",
                        ComponentInputOwner::Instance {
                            instance_key: "supplier".into(),
                        },
                        vec![hit()],
                    )],
                ),
            ]
        };
        let mut changes = compare(
            &document(nodes(), "red", "owner"),
            &document(nodes(), "blue", "owner"),
            &BTreeMap::new(),
        );
        assert_eq!(changes.retained_counts(), (4, 2, 1));
        let proofs: Vec<_> = changes
            .proofs(&BTreeMap::new())
            .into_iter()
            .map(record)
            .collect();
        assert_eq!(proofs, [expected("owner", "receiver")]);
    }
}
