//! Deterministic document bytes and inspector markers with an explicit traversal stack.

use crate::tree::{Element, Node, Region, RegionKind};

enum Step<'a> {
    Node(&'a Node, bool),
    ElementEnd(&'a str, bool),
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
    let mut plaintext = false;
    while let Some(step) = pending.pop() {
        let (node, raw) = match step {
            Step::Node(node, raw) => (node, raw),
            Step::ElementEnd(name, entered_plaintext) => {
                if plaintext == entered_plaintext {
                    output.push_str(&format!("</{name}>"));
                }
                continue;
            }
            Step::RegionEnd(region, marker, pushed) => {
                if pushed {
                    instances.pop();
                }
                if !plaintext && let Some(kind) = marker {
                    output.push_str(&format!("<!--mokly-{kind}:end id=\"{}\"-->", region.id));
                }
                continue;
            }
        };
        match node {
            Node::Text(text) if raw => output.push_str(text),
            Node::Text(text) => output.push_str(&escape(text)),
            Node::Comment(text) => {
                if !(plaintext && text.starts_with("mokly-normalize:")) {
                    output.push_str(&format!("<!--{text}-->"));
                }
            }
            Node::Doctype(name) => output.push_str(&format!("<!doctype {name}>")),
            Node::Element(element) => {
                start(element, &mut output);
                if !(element.is_html() && void(&element.name)) {
                    pending.push(Step::ElementEnd(&element.name, plaintext));
                }
                if element.is_html() && element.name == "plaintext" {
                    plaintext = true;
                }
                let raw = element.is_html() && raw_text(&element.name);
                pending.extend(
                    element
                        .children
                        .iter()
                        .rev()
                        .map(|node| Step::Node(node, raw)),
                );
            }
            Node::Region { region, children } => {
                let marker = if plaintext {
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

fn start(element: &Element, output: &mut String) {
    output.push('<');
    output.push_str(&element.name);
    for attribute in &element.attributes {
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
