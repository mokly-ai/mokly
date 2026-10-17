//! Effective browsing target metadata and first-base lookup.

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};
use crate::tree::{self, Node};

pub(crate) fn request_target(value: &str) -> Result<Option<String>> {
    let lower = value.to_ascii_lowercase();
    if value.is_empty() || lower == "_self" {
        return Ok(None);
    }
    if matches!(lower.as_str(), "_top" | "_parent" | "_blank") {
        return Ok(Some(lower));
    }
    if value
        .as_bytes()
        .first()
        .is_some_and(u8::is_ascii_alphanumeric)
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._:-".contains(&c))
    {
        return Ok(Some(value.into()));
    }
    Err(invalid(
        Code::BuildInvalid,
        format!("invalid catalogue link target {value:?}"),
    ))
}

pub(crate) fn first_base(nodes: &[Node], attribute: &str) -> Option<String> {
    tree::walk(nodes).find_map(|node| match node {
        Node::Element(element) if element.name == "base" => {
            element.get(attribute).map(str::to_owned)
        }
        _ => None,
    })
}
