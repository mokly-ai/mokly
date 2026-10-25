//! Reparsed namespace evidence must confirm predicted plaintext before raw bytes survive.

use crate::parse;
use crate::serialize;
use crate::support;
use crate::tree::{Node, Region, RegionKind, element, walk};

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
    for tree in [&parsed, &parse::delivered_document(&html)] {
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
    let mut math = parse::delivered_fragment("<math><annotation-xml></annotation-xml></math>");
    let mut svg = parse::delivered_fragment("<svg><foreignObject></foreignObject></svg>");
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
    let mut nodes = parse::delivered_fragment("<form><math><mi></mi></math></form>");
    let mi = &mut nodes[0].children_mut().unwrap()[0].children_mut().unwrap()[0];
    mi.children_mut().unwrap().push(element(
        "form",
        &[],
        vec![element("mglyph", &[], vec![literal()])],
    ));
    nodes.push(element("p", &[], vec![Node::Text("<b>literal</b>".into())]));
    assert_literal(nodes);
}

fn raw_style_literal(nodes: Vec<Node>) -> Vec<Node> {
    let catalogue = support::prepared_html("<p>Home</p>", "<p>Note</p>");
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    reparse(nodes, entry, &catalogue).0
}

fn assert_style_literal(nodes: Vec<Node>) {
    let parsed = raw_style_literal(nodes);
    let html = serialize::html(&parsed);
    assert!(
        !walk(&parsed).any(|node| matches!(node, Node::Element(element) if element.name == "img")),
        "{html}"
    );
    assert!(
        html.contains("&lt;img src=x onerror=alert(1)&gt;"),
        "{html}"
    );
}

#[test]
fn math_annotation_style_uses_escaped_retry_when_parser_keeps_foreign_style() {
    let mut nodes = parse::delivered_fragment("<math><annotation-xml></annotation-xml></math>");
    let annotation = nodes[0].children_mut().unwrap()[0].children_mut().unwrap();
    annotation.push(element("input", &[], Vec::new()));
    annotation.push(element(
        "svg",
        &[],
        vec![element(
            "foreignObject",
            &[],
            vec![element(
                "style",
                &[],
                vec![Node::Text(
                    "a::after{content:\"<img src=x onerror=alert(1)>\"}".into(),
                )],
            )],
        )],
    ));
    assert_style_literal(nodes);
}

#[test]
fn nested_form_style_uses_escaped_retry_when_parser_ignores_form() {
    let mut nodes = parse::delivered_fragment("<form><math><mi></mi></math></form>");
    let mi = &mut nodes[0].children_mut().unwrap()[0].children_mut().unwrap()[0];
    mi.children_mut().unwrap().push(element(
        "form",
        &[],
        vec![element(
            "mglyph",
            &[],
            vec![element(
                "style",
                &[],
                vec![Node::Text(
                    "a{content:\"<img src=x onerror=alert(1)>\"}".into(),
                )],
            )],
        )],
    ));
    assert_style_literal(nodes);
}

#[test]
fn escaped_retry_keeps_regions_and_later_element_metadata() {
    let mut nodes = parse::delivered_fragment("<math><annotation-xml></annotation-xml></math>");
    let annotation = nodes[0].children_mut().unwrap()[0].children_mut().unwrap();
    annotation.push(element("input", &[], Vec::new()));
    annotation.push(element(
        "style",
        &[],
        vec![Node::Text("a{content:\"<img src=x>\"}".into())],
    ));
    nodes.push(Node::Region {
        region: Region {
            id: "later".into(),
            kind: RegionKind::Instance {
                key: "instance".into(),
                path: "component".into(),
                local_id: "later".into(),
                props_key: "props".into(),
            },
        },
        children: vec![element("p", &[], vec![Node::Text("later".into())])],
    });
    let repaired = raw_style_literal(nodes);
    assert!(walk(&repaired).any(|node| matches!(
        node,
        Node::Region { region, .. } if region.id == "later"
    )));
    assert!(walk(&repaired).any(|node| matches!(
        node,
        Node::Element(element) if element.name == "p"
    )));
}

#[test]
fn escaped_plaintext_retry_keeps_later_regions_and_end_tags() {
    let mut nodes = parse::delivered_fragment("<math><annotation-xml></annotation-xml></math>");
    let annotation = nodes[0].children_mut().unwrap()[0].children_mut().unwrap();
    annotation.push(element("input", &[], Vec::new()));
    annotation.push(element(
        "svg",
        &[],
        vec![element(
            "foreignObject",
            &[],
            vec![element("plaintext", &[], vec![Node::Text("Note".into())])],
        )],
    ));
    nodes.push(Node::Region {
        region: Region {
            id: "after-plaintext".into(),
            kind: RegionKind::Instance {
                key: "instance".into(),
                path: "component".into(),
                local_id: "after-plaintext".into(),
                props_key: "props".into(),
            },
        },
        children: vec![element("p", &[], vec![Node::Text("after".into())])],
    });
    let repaired = raw_style_literal(nodes);
    assert!(walk(&repaired).any(|node| matches!(
        node,
        Node::Region { region, .. } if region.id == "after-plaintext"
    )));
    assert!(walk(&repaired).any(|node| matches!(
        node,
        Node::Element(element) if element.name == "p"
    )));
}

#[test]
fn later_literal_text_cannot_replace_the_predicted_plaintext_identity() {
    let nodes = vec![element(
        "style",
        &[],
        vec![element(
            "plaintext",
            &[],
            vec![Node::Text(
                "</style><b>literal</b><plaintext data-mokly-normalize=\"1\">tail".into(),
            )],
        )],
    )];
    let parsed = repaired(nodes);
    assert!(
        !walk(&parsed).any(|node| matches!(node, Node::Element(element) if element.name == "b")),
        "{}",
        serialize::html(&parsed)
    );
    let html = serialize::html(&parsed);
    assert!(html.contains("&lt;b&gt;literal&lt;/b&gt;"), "{html}");
}
