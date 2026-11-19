//! Exact document bytes and complete annotations govern shared preparation.

use mokly_html::tree::{Node, Region, RegionKind};
use mokly_model::usage::CatalogueUsage;

use super::support::{ROUTE, artifact, prepare, prepare_options};

#[test]
fn equal_documents_with_identity_path_pairs_avoid_restoration_and_keep_ignore_and_input_signals() {
    for ready in [true, false] {
        let mut before = artifact();
        if !ready {
            before.document.as_mut().unwrap().usage = CatalogueUsage::Pending;
        }
        let (prepared, restores) = prepare(before.clone(), before);
        assert_eq!(
            restores, 0,
            "equal complete inputs must not restore the base"
        );
        let material = prepared.material.unwrap();
        assert!(!material.changed);
        assert!(!material.root_changed);
        assert!(!material.ignored_only);
        assert_eq!(material.ignored_ids, ["chrome"]);
        assert_eq!((material.inputs, material.structure), (!ready, !ready));
    }
}

#[test]
fn equal_input_keys_with_changed_exact_bytes_use_the_complete_path() {
    let before = artifact();
    let mut after = before.clone();
    after.bytes.extend_from_slice(b"\n");
    let (prepared, restores) = prepare(before, after);
    assert_eq!(
        restores, 1,
        "the exact-byte proof must reject changed bytes"
    );
    assert!(!prepared.material.unwrap().changed);
}

#[test]
fn a_catalogue_path_change_moved_view_or_different_route_keeps_complete_preparation() {
    for (preserved, moved, route) in [
        (false, false, ROUTE),
        (true, true, ROUTE),
        (true, false, "other/index.desktop.html"),
    ] {
        let before = artifact();
        let (prepared, restores) = prepare_options(before.clone(), before, preserved, moved, route);
        assert_eq!(restores, 1, "path admission must preserve normalization");
        assert!(!prepared.equal_document);
    }
}

#[test]
fn equal_bytes_with_different_usage_ignores_or_style_owners_use_the_complete_path() {
    for field in ["style owners", "usage", "ignore"] {
        let before = artifact();
        let mut after = before.clone();
        let document = after.document.as_mut().unwrap();
        match field {
            "usage" => document.usage = CatalogueUsage::Unavailable,
            "ignore" => document.tree.push(Node::Region {
                region: Region {
                    id: "r-2".into(),
                    kind: RegionKind::Ignore {
                        id: "new".into(),
                        material_key: None,
                    },
                },
                children: vec![],
            }),
            "style owners" => {
                let Node::Region { children, .. } = &mut document.tree[0] else {
                    panic!("ignore region")
                };
                let Node::Element(element) = &mut children[0] else {
                    panic!("paragraph")
                };
                element.style_owners = Some(vec!["card".into()]);
            }
            _ => unreachable!(),
        }
        assert_eq!(before.bytes, after.bytes);
        let (_, restores) = prepare(before, after);
        assert_eq!(restores, 1, "changed {field} must reject sharing");
    }
}
