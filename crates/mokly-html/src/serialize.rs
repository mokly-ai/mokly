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
    document(nodes, false).html
}

/// Internal serialization evidence for the normalization parse.
pub(crate) struct Serialized {
    /// Bytes for the next parser pass.
    pub(crate) html: String,
    /// Repair identity of the element that activated predicted plaintext mode.
    pub(crate) plaintext: Option<PlaintextStart>,
    /// Repair identities and names of elements whose contents were written raw.
    pub(crate) raw_text: Vec<RawTextStart>,
}

/// Predicted activation point, before any subsequent raw text is written.
pub(crate) struct PlaintextStart {
    /// Private repair identity attached to the predicted element.
    pub(crate) id: String,
    /// Byte offset immediately after its serialized start tag.
    pub(crate) prefix_end: usize,
}

/// One raw-text element written under the predicted HTML parser context.
pub(crate) struct RawTextStart {
    /// Private repair identity attached to the element.
    pub(crate) id: String,
    /// Serialized element name.
    pub(crate) name: String,
}

/// Escape every text node on a conservative retry, including normally raw text.
pub(crate) fn document(nodes: &[Node], escape_text: bool) -> Serialized {
    document_with_options(nodes, escape_text, true)
}

/// Serialize with an optional plaintext prediction for a conservative retry.
pub(crate) fn document_with_options(
    nodes: &[Node],
    escape_text: bool,
    predict_plaintext: bool,
) -> Serialized {
    let mut output = String::new();
    let mut plaintext_start = None;
    let mut pending: Vec<_> = nodes
        .iter()
        .rev()
        .map(|node| Step::Node(node, false))
        .collect();
    let mut instances: Vec<(&str, &str)> = Vec::new();
    let mut mode = if predict_plaintext {
        TextMode::default()
    } else {
        TextMode::without_plaintext()
    };
    let mut raw_text_starts = Vec::new();
    while let Some(step) = pending.pop() {
        let (node, raw) = match step {
            Step::Node(node, raw) => (node, raw),
            Step::ElementEnd(name, entered_plaintext, token) => {
                mode.leave(token, name);
                if mode.plaintext() == entered_plaintext {
                    output.push_str(&format!("</{name}>"));
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
            Node::Text(text) if !escape_text && (raw || mode.plaintext()) => output.push_str(text),
            Node::Text(text) => output.push_str(&escape(text)),
            Node::Comment(text) => {
                if !(mode.plaintext() && text.starts_with("mokly-normalize:")) {
                    output.push_str(&format!("<!--{text}-->"));
                }
            }
            Node::Doctype(name) => output.push_str(&format!("<!doctype {name}>")),
            Node::Element(element) => {
                let plaintext = mode.plaintext();
                start(element, &mut output, plaintext);
                let token = mode.enter(element);
                if !plaintext && mode.plaintext() {
                    plaintext_start = Some(PlaintextStart {
                        id: element.get(ATTRIBUTE).unwrap_or_default().into(),
                        prefix_end: output.len(),
                    });
                }
                if !(element.is_html() && void(&element.name)) {
                    pending.push(Step::ElementEnd(&element.name, plaintext, token));
                } else {
                    mode.leave(token, &element.name);
                }
                let raw = token.is_html()
                    && raw_text(&element.name)
                    && (element.name != "plaintext" || mode.plaintext());
                if raw && let Some(id) = element.get(ATTRIBUTE) {
                    raw_text_starts.push(RawTextStart {
                        id: id.into(),
                        name: element.name.clone(),
                    });
                }
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
    Serialized {
        html: output,
        plaintext: plaintext_start,
        raw_text: raw_text_starts,
    }
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
