//! Reparsed namespace evidence must confirm predicted plaintext before raw bytes survive.

use crate::parse;
use crate::serialize;
use crate::support;
use crate::tree::{Node, element, walk};

use super::reparse;

fn repaired(nodes: Vec<Node>) -> Vec<Node> {
    let catalogue = support::prepared_html("<p>Home</p>", "<p>Note</p>");
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    reparse(nodes, entry, &catalogue).0
}

fn literal() -> Node {
    element(
        "plaintext",
        &[],
        vec![Node::Text("Note & <b>literal</b>".into())],
    )
}

fn assert_literal(nodes: Vec<Node>) {
    let parsed = repaired(nodes);
    let html = serialize::html(&parsed);
    for tree in [&parsed, &parse::document(&html)] {
        assert!(
            !walk(tree).any(|node| matches!(node, Node::Element(element) if element.name == "b")),
            "{html}"
        );
    }
    assert!(html.contains("&lt;b&gt;literal&lt;/b&gt;"), "{html}");
    assert!(!html.contains("data-mokly-normalize"), "{html}");
}

#[test]
fn math_void_graft_does_not_activate_raw_text_under_annotation_xml() {
    let mut math = parse::fragment("<math><annotation-xml></annotation-xml></math>");
    let mut svg = parse::fragment("<svg><foreignObject></foreignObject></svg>");
    svg[0].children_mut().unwrap()[0]
        .children_mut()
        .unwrap()
        .push(literal());
    let children = math[0].children_mut().unwrap()[0].children_mut().unwrap();
    children.push(element("input", &[], Vec::new()));
    children.extend(svg);
    math.push(element("p", &[], vec![Node::Text("<b>literal</b>".into())]));
    assert_literal(math);
}

#[test]
fn ignored_nested_form_does_not_activate_raw_text_under_math_text() {
    let mut nodes = parse::fragment("<form><math><mi></mi></math></form>");
    let mi = &mut nodes[0].children_mut().unwrap()[0].children_mut().unwrap()[0];
    mi.children_mut().unwrap().push(element(
        "form",
        &[],
        vec![element("mglyph", &[], vec![literal()])],
    ));
    nodes.push(element("p", &[], vec![Node::Text("<b>literal</b>".into())]));
    assert_literal(nodes);
}
