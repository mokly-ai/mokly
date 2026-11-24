//! Source-attributed URL policy for composed HTML and Markdown documents.

use mokly_model::catalogue::SourceLocation;
use serde_json::Value;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{self, Node};

/// Validate final href and src values before resource traversal.
pub fn validate(nodes: &[Node], fallback: &SourceLocation) -> Result<()> {
    for node in tree::walk(nodes) {
        if let Node::Element(element) = node {
            for name in ["href", "src"] {
                if let Some(url) = element.get(name)
                    && !allowed(url)
                {
                    return Err(invalid(
                        Code::BuildInvalid,
                        rejection_reason(name, &element.name, url),
                    )
                    .at(element.source.clone().unwrap_or_else(|| fallback.clone())));
                }
            }
        }
    }
    Ok(())
}

/// Build the diagnostic for a URL rejected by the document policy.
pub(crate) fn rejection_reason(name: &str, tag: &str, url: &str) -> String {
    let mut message = format!(
        "unsafe rendered document: {name} on <{tag}> is not an allowed URL: {}",
        Value::String(url.into())
    );
    if scheme(url).is_some_and(|name| name.eq_ignore_ascii_case("data")) {
        message.push_str(
            "; remove the dataurl loader from moduleResolution.loaders so that Mokly delivers the imported file",
        );
    }
    message
}

/// Check document URL syntax; the public closure separately checks local paths.
pub(crate) fn allowed(url: &str) -> bool {
    if url.trim() != url
        || url.starts_with('/')
        || url.contains('\\')
        || url.chars().any(char::is_control)
    {
        return false;
    }
    scheme(url).is_none_or(|name| {
        ["http", "https", "mailto"]
            .iter()
            .any(|allowed| name.eq_ignore_ascii_case(allowed))
    })
}

fn scheme(url: &str) -> Option<&str> {
    let prefix = url.split(['/', '?', '#']).next().unwrap_or(url);
    prefix.split_once(':').map(|(name, _)| name).filter(|name| {
        name.starts_with(|c: char| c.is_ascii_alphabetic())
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"+-.".contains(&c))
    })
}
