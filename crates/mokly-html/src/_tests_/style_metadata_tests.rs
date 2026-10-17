//! Iterative tree operations preserve the trusted style annotations used by comparison.

use crate::normalization::{Repair, metadata};
use crate::normalization_annotate;
use crate::tree::{Node, element, walk};
use crate::{parse, serialize, tree_transform};

fn style() -> Node {
    let mut node = element("style", &[], vec![Node::Text(".card{color:red}".into())]);
    let Node::Element(style) = &mut node else {
        panic!()
    };
    style.style_owners = Some(vec!["card".into()]);
    node
}

#[test]
fn cloning_taking_and_equality_keep_trusted_style_owners() {
    let original = style();
    let mut copied = original.clone();
    assert_eq!(copied, original);
    assert!(format!("{copied:?}").contains("style_owners: Some([\"card\"])"));
    let mut taken = copied.take_element().unwrap();
    assert_eq!(taken.style_owners, Some(vec!["card".into()]));
    taken.style_owners = Some(vec!["another".into()]);
    assert_ne!(Node::Element(taken), original);
}

#[test]
fn iterative_annotation_preserves_owners_through_browser_repair() {
    let nodes = vec![element(
        "html",
        &[],
        vec![
            element("head", &[], vec![style()]),
            element("body", &[], vec![]),
        ],
    )];
    let mut repair = Repair::default();
    let annotated = normalization_annotate::annotate(nodes, &mut repair);
    let reparsed = parse::document(&serialize::html(&annotated));
    let repaired = tree_transform::postorder(reparsed, &mut |mut node| {
        if let Node::Element(element) = &mut node {
            metadata(element, &repair);
        }
        Ok(vec![node])
    })
    .unwrap();
    let owners = walk(&repaired)
        .filter_map(|node| match node {
            Node::Element(element) if element.name == "style" => element.style_owners.clone(),
            _ => None,
        })
        .collect::<Vec<_>>();
    assert_eq!(owners, [vec!["card".to_owned()]]);
}
