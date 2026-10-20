//! Component grafts must not turn escaped foreign-content text into markup.

use std::sync::Arc;

use mokly_model::axes::{ColorScheme, Viewport};
use unimock::Unimock;

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::normalization::Repair;
use crate::normalization_annotate::annotate;
use crate::tree::{Node, element, walk};
use crate::{normalization, parse, serialize};

use super::support;

fn compose(body: &str, component: &str) -> Vec<Node> {
    let catalogue = support::prepared_html(body, component);
    let entry = catalogue
        .model
        .entries
        .iter()
        .find(|entry| entry.metadata.path == "home")
        .unwrap();
    let mut document = HtmlComposer {
        fragments: Arc::new(Unimock::new(())),
    }
    .compose(&ComposeRequest {
        catalogue: &catalogue,
        entry,
        viewport: Viewport::Mobile,
        color_scheme: ColorScheme::Light,
        stylesheets: vec![],
    })
    .unwrap();
    normalization::composed(&mut document, entry, &catalogue).unwrap();
    document.tree
}

#[test]
fn foreign_plaintext_components_keep_later_escaped_text_inert() {
    for (start, end) in [
        ("<svg>", "</svg>"),
        ("<svg><g>", "</g></svg>"),
        ("<math>", "</math>"),
        ("<svg><foreignObject><svg>", "</svg></foreignObject></svg>"),
    ] {
        let nodes = compose(
            &format!("{start}<ui-note></ui-note>{end}<p>&lt;img src=x onerror=alert(1)&gt;</p>"),
            "<plaintext>Note",
        );
        assert!(
            !walk(&nodes)
                .any(|node| matches!(node, Node::Element(element) if element.name == "img")),
            "{start}: {}",
            serialize::html(&nodes)
        );
        let html = serialize::html(&nodes);
        assert!(
            html.contains("&lt;img src=x onerror=alert(1)&gt;"),
            "{html}"
        );
        assert_eq!(html, serialize::html(&parse::document(&html)));
    }
}

#[test]
fn foreign_plaintext_components_escape_their_direct_literal_content() {
    let nodes = compose(
        "<svg><ui-note></ui-note></svg>",
        "<plaintext><img src=x onerror=alert(1)>",
    );
    assert!(
        !walk(&nodes).any(|node| matches!(node, Node::Element(element) if element.name == "img")),
        "{}",
        serialize::html(&nodes)
    );
}

#[test]
fn foreign_integration_points_still_enter_html_plaintext_mode() {
    for (start, end) in [
        ("<svg><foreignObject>", "</foreignObject></svg>"),
        ("<svg><desc>", "</desc></svg>"),
        ("<svg><title>", "</title></svg>"),
        ("<math><mi>", "</mi></math>"),
        ("<math><mtext>", "</mtext></math>"),
    ] {
        let nodes = compose(
            &format!("{start}<ui-note></ui-note>{end}"),
            "<plaintext>literal & <i>text</i>",
        );
        assert!(walk(&nodes).any(|node| matches!(node, Node::Element(element) if element.name == "plaintext" && element.is_html())), "{start}");
        assert!(serialize::html(&nodes).contains("literal & <i>text</i>"));
        assert!(
            !walk(&nodes).any(|node| matches!(node, Node::Element(element) if element.name == "i"))
        );
    }
}

#[test]
fn foreign_grafts_follow_math_integration_and_html_breakout_rules() {
    for (context, plaintext) in [
        (
            "<math><annotation-xml encoding='text/xml'></annotation-xml></math>",
            false,
        ),
        (
            "<math><annotation-xml encoding='TEXT/HTML'></annotation-xml></math>",
            true,
        ),
        (
            "<math><annotation-xml encoding='application/xhtml+xml'></annotation-xml></math>",
            true,
        ),
        ("<math><mtext><mglyph></mglyph></mtext></math>", false),
        (
            "<math><mtext><malignmark></malignmark></mtext></math>",
            false,
        ),
    ] {
        let mut nodes = parse::fragment(context);
        let mut children = &mut nodes;
        while !children.is_empty() {
            children = children[0].children_mut().unwrap();
        }
        children.push(element(
            "plaintext",
            &[],
            vec![Node::Text("literal & <i>text</i>".into())],
        ));
        assert_graft_mode(nodes, plaintext);
    }
    let mut svg = parse::fragment("<svg></svg>");
    svg[0]
        .children_mut()
        .unwrap()
        .push(element("div", &[], vec![]));
    svg[0].children_mut().unwrap().push(element(
        "plaintext",
        &[],
        vec![Node::Text("literal & <i>text</i>".into())],
    ));
    assert_graft_mode(svg, true);
}

fn assert_graft_mode(nodes: Vec<Node>, plaintext: bool) {
    let mut repair = Repair::default();
    let marked = annotate(nodes, &mut repair);
    let html = serialize::html(&marked);
    assert_eq!(html.contains("literal & <i>text</i>"), plaintext, "{html}");
    let parsed = parse::document(&html);
    assert_eq!(walk(&parsed).any(|node| matches!(node, Node::Element(element) if element.name == "plaintext" && element.is_html())), plaintext, "{html}");
    assert!(
        !walk(&parsed).any(|node| matches!(node, Node::Element(element) if element.name == "i")),
        "{html}"
    );
}

#[test]
fn foreign_plaintext_does_not_stop_metadata_annotation() {
    let mut svg = parse::fragment("<svg></svg>");
    svg[0]
        .children_mut()
        .unwrap()
        .push(element("plaintext", &[], vec![Node::Text("Note".into())]));
    svg.push(element("p", &[], vec![Node::Text("<img src=x>".into())]));
    let mut repair = Repair::default();
    let marked = annotate(svg, &mut repair);
    assert_eq!(repair.elements.len(), 3);
    assert!(serialize::html(&marked).contains("&lt;img src=x&gt;"));
}
