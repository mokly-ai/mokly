//! Deterministic document bytes and inspector marker serialization.

use crate::tree::{Node, RegionKind};

/// Serialize an owned tree, writing markers only for instance and slot regions.
pub fn html(nodes: &[Node]) -> String {
    let mut output = String::new();
    write(nodes, false, &mut output, &mut Vec::new());
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

fn write(nodes: &[Node], raw: bool, output: &mut String, instances: &mut Vec<(String, String)>) {
    for node in nodes {
        match node {
            Node::Text(text) if raw => output.push_str(text),
            Node::Text(text) => output.push_str(&escape(text)),
            Node::Comment(text) => output.push_str(&format!("<!--{text}-->")),
            Node::Doctype(name) => output.push_str(&format!("<!doctype {name}>")),
            Node::Element(element) => {
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
                let raw = element.is_html()
                    && matches!(
                        element.name.as_str(),
                        "script"
                            | "style"
                            | "xmp"
                            | "iframe"
                            | "noembed"
                            | "noframes"
                            | "plaintext"
                    );
                write(&element.children, raw, output, instances);
                if !(element.is_html() && void(&element.name)) {
                    output.push_str(&format!("</{}>", element.name));
                }
            }
            Node::Region { region, children } => {
                let marker = match &region.kind {
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
                            .map_or("", |(_, id)| id);
                        Some((
                            "slot",
                            format!("instance=\"{}\" name=\"{}\"", receiver, escape(name)),
                        ))
                    }
                    _ => None,
                };
                if let Some((kind, attributes)) = &marker {
                    output.push_str(&format!(
                        "<!--mokly-{kind}:start id=\"{}\" {attributes}-->",
                        region.id
                    ));
                }
                if let RegionKind::Instance { key, .. } = &region.kind {
                    instances.push((key.clone(), region.id.clone()));
                }
                write(children, raw, output, instances);
                if matches!(region.kind, RegionKind::Instance { .. }) {
                    instances.pop();
                }
                if let Some((kind, _)) = marker {
                    output.push_str(&format!("<!--mokly-{kind}:end id=\"{}\"-->", region.id));
                }
            }
        }
    }
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
