//! Serialized component text must not close a scripting-enabled HTML noscript.

use std::sync::Arc;

use html5ever::tendril::TendrilSink;
use html5ever::tree_builder::TreeBuilderOpts;
use html5ever::{ParseOpts, parse_document};
use mokly_model::axes::{ColorScheme, Viewport};
use unimock::Unimock;

use crate::composition::{ComposeRequest, Composer, HtmlComposer};
use crate::html_arena::Arena;
use crate::tree::{Node, walk};
use crate::{normalization, parse, serialize};

use super::support;

#[test]
fn noscript_component_plaintext_cannot_expose_markup_with_scripting_enabled() {
    for close in ["</noscript>", "</NoScript>", "</NOSCRIPT>"] {
        let payload = format!("Before {close}<img src=x onerror=alert(1)>After &amp;");
        let nodes = compose(
            "<noscript><ui-note></ui-note></noscript>",
            &format!("<plaintext>{payload}"),
        );
        let html = serialize::html(&nodes);
        assert_inert_and_stable(&html);
        assert!(html.contains(&payload.replacen('<', "&lt;", 1)), "{html}");
    }
}

#[test]
fn noscript_escaped_sibling_text_stays_inert_after_component_plaintext() {
    let nodes = compose(
        "<noscript><ui-note></ui-note>&lt;/NoScript&gt;&lt;img src=x onerror=alert(1)&gt;</noscript>",
        "<plaintext>Note",
    );
    let html = serialize::html(&nodes);
    assert!(
        html.contains("&lt;/NoScript><img src=x onerror=alert(1)>"),
        "{html}"
    );
    assert_inert_and_stable(&html);
}

#[test]
fn noscript_end_tags_split_between_component_and_sibling_text_stay_inert() {
    let nodes = compose(
        "<noscript><ui-note></ui-note>Script&gt;&lt;img src=x onerror=alert(1)&gt;</noscript>",
        "<plaintext>Note</No",
    );
    let html = serialize::html(&nodes);
    assert_inert_and_stable(&html);
    assert!(html.contains("Note&lt;/NoScript><img"), "{html}");
}

#[test]
fn noscript_later_comments_and_literal_end_tags_cannot_expose_markup() {
    for later in [
        "<!--</NoScript><img src=x onerror=alert(1)>-->",
        "<noscript></noscript>&lt;img src=x onerror=alert(1)&gt;",
    ] {
        let nodes = compose(
            &format!("<noscript><ui-note></ui-note>{later}</noscript>"),
            "<plaintext>Note",
        );
        let html = serialize::html(&nodes);
        assert_inert_and_stable(&html);
        assert!(
            html.to_ascii_lowercase().contains("&lt;/noscript>"),
            "{html}"
        );
    }
}

#[test]
fn noscript_raw_text_guard_ends_with_its_html_ancestor() {
    let nodes = parse::document(
        "<!doctype html><html><head></head><body><noscript><xmp>Inside </NoScript><img src=x></xmp></noscript><plaintext>Outside </NoScript><img src=x>",
    );
    let html = serialize::html(&nodes);
    assert!(html.contains("Inside &lt;/NoScript><img src=x>"), "{html}");
    assert!(html.contains("Outside </NoScript><img src=x>"), "{html}");
    assert_inert_and_stable(&html);
}

#[test]
fn foreign_noscript_elements_keep_ordinary_escaped_text() {
    for tag in ["svg", "math"] {
        let nodes = compose(
            &format!("<{tag}><noscript><ui-note></ui-note></noscript></{tag}>"),
            "<plaintext></NoScript><img src=x onerror=alert(1)>",
        );
        let html = serialize::html(&nodes);
        assert!(
            html.contains("&lt;/NoScript&gt;&lt;img src=x onerror=alert(1)&gt;"),
            "{html}"
        );
        assert!(walk(&nodes).any(|node| matches!(node, Node::Element(element) if element.name == "noscript" && !element.is_html())));
        assert_inert_and_stable(&html);
    }
}

#[test]
fn html_noscript_in_foreign_integration_points_guards_plaintext() {
    for (start, end) in [
        ("<svg><foreignObject>", "</foreignObject></svg>"),
        ("<math><mtext>", "</mtext></math>"),
    ] {
        let nodes = compose(
            &format!("{start}<noscript><ui-note></ui-note></noscript>{end}"),
            "<plaintext></NoScript><img src=x onerror=alert(1)>",
        );
        let html = serialize::html(&nodes);
        assert!(
            html.contains("&lt;/NoScript><img src=x onerror=alert(1)>"),
            "{html}"
        );
        assert_inert_and_stable(&html);
    }
}

#[test]
fn foreign_noscript_ancestor_does_not_change_html_plaintext_characters() {
    for (start, end) in [
        (
            "<svg><noscript><foreignObject>",
            "</foreignObject></noscript></svg>",
        ),
        ("<math><noscript><mtext>", "</mtext></noscript></math>"),
    ] {
        let nodes = compose(
            &format!("{start}<ui-note></ui-note>{end}"),
            "<plaintext></NoScript><img src=x onerror=alert(1)>",
        );
        let html = serialize::html(&nodes);
        assert!(
            html.contains("</NoScript><img src=x onerror=alert(1)>"),
            "{html}"
        );
        assert_inert_and_stable(&html);
    }
}

fn assert_inert_and_stable(html: &str) {
    let browser = parse_document(
        Arena::default(),
        ParseOpts {
            tree_builder: TreeBuilderOpts {
                scripting_enabled: true,
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .one(html);
    assert!(
        !walk(&browser).any(|node| matches!(node, Node::Element(element) if element.name == "img")),
        "{html}"
    );
    let first = parse::document(html);
    let second_bytes = serialize::html(&first);
    assert_eq!(html, second_bytes);
    let second = parse::document(&second_bytes);
    assert_eq!(first, second);
    assert_eq!(second_bytes, serialize::html(&second));
}

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
