//! Deterministic document bytes and inspector markers with an explicit traversal stack.

use crate::normalization::ATTRIBUTE;
use crate::text_mode::{TextMode, Token};
use crate::tree::{Element, Node, Region, RegionKind};

enum Step<'a> {
    Node(&'a Node, bool),
    ElementEnd(&'a str, bool, Token),
    RegionEnd(&'a Region, Option<&'static str>, bool),
}

/// Serialize an owned tree, writing markers only for instance and slot regions.
pub fn html(nodes: &[Node]) -> String {
    let mut output = String::new();
    let mut pending: Vec<_> = nodes
        .iter()
        .rev()
        .map(|node| Step::Node(node, false))
        .collect();
    let mut instances: Vec<(&str, &str)> = Vec::new();
    let mut mode = TextMode::default();
    while let Some(step) = pending.pop() {
        let (node, raw) = match step {
            Step::Node(node, raw) => (node, raw),
            Step::ElementEnd(name, entered_plaintext, token) => {
                mode.leave(token, name);
                if mode.plaintext() == entered_plaintext {
                    if entered_plaintext {
                        mode.write_raw(&format!("</{name}>"), &mut output);
                    } else {
                        output.push_str(&format!("</{name}>"));
                    }
                }
                continue;
            }
            Step::RegionEnd(region, marker, pushed) => {
                if pushed {
                    instances.pop();
                }
                if !mode.plaintext()
                    && let Some(kind) = marker
                {
                    output.push_str(&format!("<!--mokly-{kind}:end id=\"{}\"-->", region.id));
                }
                continue;
            }
        };
        match node {
            Node::Text(text) if raw || mode.plaintext() => mode.write_raw(text, &mut output),
            Node::Text(text) => output.push_str(&escape(text)),
            Node::Comment(text) => {
                if !(mode.plaintext() && text.starts_with("mokly-normalize:")) {
                    mode.write_raw(&format!("<!--{text}-->"), &mut output);
                }
            }
            Node::Doctype(name) => output.push_str(&format!("<!doctype {name}>")),
            Node::Element(element) => {
                let plaintext = mode.plaintext();
                start(element, &mut output, plaintext);
                let token = mode.enter(element);
                if !(element.is_html() && void(&element.name)) {
                    pending.push(Step::ElementEnd(&element.name, plaintext, token));
                } else {
                    mode.leave(token, &element.name);
                }
                let raw = element.is_html()
                    && raw_text(&element.name)
                    && (element.name != "plaintext" || mode.plaintext());
                pending.extend(
                    element
                        .children
                        .iter()
                        .rev()
                        .map(|node| Step::Node(node, raw)),
                );
            }
            Node::Region { region, children } => {
                let marker = if mode.plaintext() {
                    None
                } else {
                    marker(region, &instances)
                };
                if let Some((kind, attributes)) = &marker {
                    output.push_str(&format!(
                        "<!--mokly-{kind}:start id=\"{}\" {attributes}-->",
                        region.id
                    ));
                }
                let pushed = if let RegionKind::Instance { key, .. } = &region.kind {
                    instances.push((key, &region.id));
                    true
                } else {
                    false
                };
                pending.push(Step::RegionEnd(
                    region,
                    marker.map(|(kind, _)| kind),
                    pushed,
                ));
                pending.extend(children.iter().rev().map(|node| Step::Node(node, raw)));
            }
        }
    }
    output
}

/// Escape text or an attribute value exactly once.
pub fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn start(element: &Element, output: &mut String, plaintext: bool) {
    output.push('<');
    output.push_str(&element.name);
    for attribute in &element.attributes {
        if plaintext && attribute.name == ATTRIBUTE {
            continue;
        }
        output.push_str(&format!(
            " {}=\"{}\"",
            attribute.name,
            escape(&attribute.value)
        ));
    }
    output.push('>');
    if element.is_html()
        && matches!(element.name.as_str(), "pre" | "textarea" | "listing")
        && matches!(element.children.first(), Some(Node::Text(text)) if text.starts_with('\n'))
    {
        output.push('\n');
    }
}

fn marker(region: &Region, instances: &[(&str, &str)]) -> Option<(&'static str, String)> {
    match &region.kind {
        RegionKind::Instance {
            path,
            key,
            props_key,
            ..
        } => Some((
            "instance",
            format!(
                "path=\"{}\" instance=\"{key}\" props=\"{props_key}\"",
                escape(path)
            ),
        )),
        RegionKind::Slot {
            name, instance_key, ..
        } => {
            let receiver = instances
                .iter()
                .rev()
                .find(|(key, _)| key == instance_key)
                .map_or("", |(_, id)| *id);
            Some((
                "slot",
                format!("instance=\"{receiver}\" name=\"{}\"", escape(name)),
            ))
        }
        _ => None,
    }
}

pub(crate) fn raw_text(name: &str) -> bool {
    matches!(
        name,
        "script" | "style" | "xmp" | "iframe" | "noembed" | "noframes" | "plaintext"
    )
}

fn void(name: &str) -> bool {
    matches!(
        name,
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "param"
            | "source"
            | "track"
            | "wbr"
    )
}
