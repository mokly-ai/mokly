//! Deep module edges preserve stylesheet encounter order without recursive calls.

use std::collections::{BTreeMap, BTreeSet};
use std::thread;

#[test]
fn exports_from_one_module_share_one_stylesheet_root() {
    let modules = [
        ("one".into(), vec!["shared.css".into()]),
        ("two".into(), vec!["other.css".into()]),
    ]
    .into();
    let roots = super::roots(
        &modules,
        None,
        &["one".into(), "one".into(), "two".into()],
        &BTreeMap::new(),
    );
    assert_eq!(
        roots
            .iter()
            .map(|root| root.path.as_str())
            .collect::<Vec<_>>(),
        ["one", "two"]
    );
    assert_eq!(roots[0].stylesheets, ["shared.css"]);
    assert_eq!(roots[1].stylesheets, ["other.css"]);
}

#[test]
fn stylesheet_walk_skips_branches_without_css_at_both_sizes() {
    for count in [8, 32] {
        let mut modules = BTreeMap::new();
        modules.insert("root".into(), vec!["shared.css".into(), "branch-0".into()]);
        for index in 0..count - 2 {
            modules.insert(
                format!("branch-{index}"),
                if index + 1 < count - 2 {
                    vec![format!("branch-{}", index + 1)]
                } else {
                    Vec::new()
                },
            );
        }
        let mut files = Vec::new();
        let mut seen = BTreeSet::new();
        let ancestors = super::stylesheet_ancestors(&modules);
        super::visit("root", &modules, &ancestors, &mut seen, &mut files);
        assert_eq!(files, ["shared.css"]);
        assert_eq!(
            seen.len(),
            2,
            "only the root and its CSS leaf require a walk"
        );
    }
}

#[test]
fn a_deep_import_chain_keeps_first_stylesheet_encounter_and_stops_cycles() {
    thread::spawn(|| {
        let mut modules = BTreeMap::new();
        for index in 0..100_000 {
            modules.insert(
                index.to_string(),
                vec![(index + 1).to_string(), "shared.css".into()],
            );
        }
        modules.insert("100000".into(), vec!["leaf.css".into(), "0".into()]);
        let mut files = Vec::new();
        let ancestors = super::stylesheet_ancestors(&modules);
        super::visit("0", &modules, &ancestors, &mut BTreeSet::new(), &mut files);
        assert_eq!(files, ["leaf.css", "shared.css"]);
    })
    .join()
    .unwrap();
}
