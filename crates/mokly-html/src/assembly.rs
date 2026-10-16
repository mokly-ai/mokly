//! Package-owned screen and component document wrappers.

use mokly_model::axes::ColorScheme;
use mokly_model::canonical::compare_utf16;

use crate::fragment::OwnedStyle;
use crate::tree::{Node, element};

/// Assemble a deterministic screen or component document.
pub(crate) fn document(
    title: &str,
    scheme: ColorScheme,
    styles: &[OwnedStyle],
    stylesheets: &[String],
    body: Vec<Node>,
) -> Vec<Node> {
    let mut head = vec![
        element("meta", &[("charset", "utf-8")], Vec::new()),
        element(
            "meta",
            &[
                ("name", "viewport"),
                ("content", "width=device-width, initial-scale=1"),
            ],
            Vec::new(),
        ),
        element("title", &[], vec![Node::Text(title.into())]),
    ];
    head.extend(collected(styles));
    head.extend(
        stylesheets
            .iter()
            .map(|href| element("link", &[("rel", "stylesheet"), ("href", href)], Vec::new())),
    );
    let scheme = match scheme {
        ColorScheme::Light => "color-scheme: light",
        ColorScheme::Dark => "color-scheme: dark",
    };
    vec![
        Node::Doctype("html".into()),
        element(
            "html",
            &[("style", scheme)],
            vec![element("head", &[], head), element("body", &[], body)],
        ),
    ]
}

pub(crate) fn append_styles(nodes: &mut [Node], styles: &[OwnedStyle]) {
    for node in nodes {
        if let Node::Element(element) = node {
            if element.name == "head" {
                element.children.extend(collected(styles));
            } else {
                append_styles(&mut element.children, styles);
            }
        }
    }
}

fn collected(styles: &[OwnedStyle]) -> Vec<Node> {
    let mut groups: Vec<(Vec<String>, Vec<String>)> = Vec::new();
    for style in styles {
        let mut owners = style.owners.clone();
        owners.sort_by(|a, b| compare_utf16(a, b));
        owners.dedup();
        let index = match groups.iter().position(|(known, _)| known == &owners) {
            Some(index) => index,
            None => {
                groups.push((owners, Vec::new()));
                groups.len() - 1
            }
        };
        if !groups[index].1.contains(&style.css) {
            groups[index].1.push(style.css.clone());
        }
    }
    groups
        .into_iter()
        .map(|(owners, rules)| {
            let owner_names = owners.join(" ");
            let attributes = if owners.is_empty() {
                Vec::new()
            } else {
                vec![("data-mokly-owners", owner_names.as_str())]
            };
            let mut style = element("style", &attributes, vec![Node::Text(rules.join("\n"))]);
            if let Node::Element(element) = &mut style {
                element.style_owners = Some(owners);
            }
            style
        })
        .collect()
}
