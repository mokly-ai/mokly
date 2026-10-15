//! Source-attributed URL policy for composed HTML and Markdown documents.

use mokly_model::catalogue::SourceLocation;
use serde_json::Value;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::Node;

/// Validate final href and src values before resource traversal.
pub fn validate(nodes: &[Node], fallback: &SourceLocation) -> Result<()> {
    for node in nodes {
        match node {
            Node::Element(element) => {
                for name in ["href", "src"] {
                    if let Some(url) = element.get(name) {
                        let lower = url.to_ascii_lowercase();
                        if url.trim() != url
                            || url.starts_with('/')
                            || url.contains('\\')
                            || url.chars().any(char::is_control)
                            || (url.contains(':')
                                && !["http:", "https:", "mailto:"]
                                    .iter()
                                    .any(|scheme| lower.starts_with(scheme)))
                        {
                            return Err(invalid(Code::BuildInvalid, format!(
                                "unsafe rendered document: {name} on <{}> is not an allowed URL: {}",
                                element.name, Value::String(url.into())
                            )).at(element.source.clone().unwrap_or_else(|| fallback.clone())));
                        }
                    }
                }
                validate(&element.children, fallback)?;
            }
            Node::Region { children, .. } => validate(children, fallback)?,
            _ => {}
        }
    }
    Ok(())
}
