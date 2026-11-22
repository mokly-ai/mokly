//! Each Markdown document loads the viewer's two faces from its own route, and the
//! final allowlist accepts only the stylesheet of that route.

use mokly_catalogue::html_input::DeliveredHtml;
use mokly_model::axes::ColorScheme;
use unimock::Unimock;

use crate::diagnostic_code::Code;
use crate::error::HtmlError;
use crate::markdown::render;
use crate::tree::{self, Node};
use crate::{parse, safety};

use super::STYLES;

const STYLESHEET_REJECTED: &str =
    "unsafe rendered document: the template must contain one owned stylesheet";

/// The two `@font-face` rules that start a stylesheet, with the shell's descriptors.
fn faces(sans: &str, mono: &str) -> String {
    format!(
        "@font-face {{\n  font-family: \"Geist\";\n  font-style: normal;\n  font-weight: 100 900;\n  font-display: swap;\n  src: url(\"{sans}\") format(\"woff2\");\n}}\n\n@font-face {{\n  font-family: \"Geist Mono\";\n  font-style: normal;\n  font-weight: 100 900;\n  font-display: swap;\n  src: url(\"{mono}\") format(\"woff2\");\n}}\n\n"
    )
}

fn document(scheme: ColorScheme, route: &str) -> Vec<Node> {
    render("# Terms", "Terms", scheme, route, &Unimock::new(())).unwrap()
}

/// The text of the document's one owned stylesheet.
fn stylesheet(nodes: &[Node]) -> String {
    tree::walk(nodes)
        .find_map(|node| match node {
            Node::Element(element) if element.name == "style" => {
                match element.children.as_slice() {
                    [Node::Text(css)] => Some(css.clone()),
                    _ => None,
                }
            }
            _ => None,
        })
        .unwrap()
}

#[test]
fn each_document_loads_both_viewer_faces_through_the_address_of_its_route() {
    for (route, scheme, sans, mono) in [
        (
            "payment/index.html",
            ColorScheme::Light,
            "../../../mokly-viewer/fonts/Geist-Variable.woff2",
            "../../../mokly-viewer/fonts/GeistMono-Variable.woff2",
        ),
        (
            "guides/intro/index.html",
            ColorScheme::Light,
            "../../../../mokly-viewer/fonts/Geist-Variable.woff2",
            "../../../../mokly-viewer/fonts/GeistMono-Variable.woff2",
        ),
        (
            "guides/intro/index.dark.html",
            ColorScheme::Dark,
            "../../../../mokly-viewer/fonts/Geist-Variable.woff2",
            "../../../../mokly-viewer/fonts/GeistMono-Variable.woff2",
        ),
    ] {
        let css = stylesheet(&document(scheme, route));
        assert_eq!(
            css.strip_suffix(STYLES),
            Some(faces(sans, mono).as_str()),
            "{route}"
        );
    }
}

#[test]
fn the_allowlist_accepts_only_the_stylesheet_of_the_documents_own_route() {
    let current = document(ColorScheme::Light, "payment/index.html");
    let without_faces = parse::html(DeliveredHtml::document(&format!(
        "<!doctype html><html lang=\"en\" style=\"color-scheme: light\"><head><title>Terms</title><style>{STYLES}</style></head><body><main><h1 id=\"terms\">Terms</h1></main></body></html>"
    )));
    let accepted = safety::validate(&current, "payment/index.html");
    assert!(accepted.is_ok(), "{accepted:?}");
    for (nodes, route) in [
        (&current, "guides/intro/index.html"),
        (&without_faces, "payment/index.html"),
    ] {
        let result = safety::validate(nodes, route);
        assert!(
            matches!(
                &result,
                Err(HtmlError::Invalid { code: Code::BuildInvalid, message, .. })
                    if message == STYLESHEET_REJECTED
            ),
            "{route}: {result:?}"
        );
    }
}

#[test]
fn face_families_are_the_first_families_of_the_generated_document_stacks() {
    let css = stylesheet(&document(ColorScheme::Light, "payment/index.html"));
    let families: Vec<_> = css
        .strip_suffix(STYLES)
        .unwrap()
        .split("font-family: \"")
        .skip(1)
        .map(|rest| rest.split('"').next().unwrap())
        .collect();
    let first_family = |property: &str| {
        STYLES
            .split(&format!("{property}:"))
            .nth(1)
            .unwrap()
            .split([',', ';'])
            .next()
            .unwrap()
            .trim()
            .trim_matches('"')
            .to_owned()
    };
    assert_eq!(
        families,
        [
            first_family("--document-sans"),
            first_family("--document-mono")
        ]
    );
}
