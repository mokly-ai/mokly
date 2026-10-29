//! Strict marker payload syntax retains duplicates and rejects trailing markup.

use std::collections::BTreeMap;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};

pub(crate) struct Marker {
    pub(crate) kind: String,
    pub(crate) start: bool,
    pub(crate) id: String,
    pub(crate) attributes: BTreeMap<String, String>,
}

pub(crate) fn parse(comment: &str) -> Result<Option<Marker>> {
    let comment = comment.trim_start();
    if !comment.starts_with("mokly-") {
        return Ok(None);
    }
    let (name, attributes) = comment
        .split_once(char::is_whitespace)
        .ok_or_else(|| invalid(Code::BuildInvalid, "malformed fragment marker"))?;
    let (kind, phase) = name
        .strip_prefix("mokly-")
        .and_then(|name| name.split_once(':'))
        .ok_or_else(|| invalid(Code::BuildInvalid, "unknown fragment marker"))?;
    if !matches!(kind, "instance" | "slot" | "ignore" | "link" | "output")
        || !matches!(phase, "start" | "end")
    {
        return Err(invalid(Code::BuildInvalid, "unknown fragment marker"));
    }
    let attributes = attributes_of(attributes)?;
    let allowed: &[&str] = match (phase, kind) {
        ("end", _) => &["id"],
        (_, "instance") => &["id", "path", "instance", "props"],
        (_, "slot") => &["id", "instance", "name"],
        (_, "ignore") => &["id", "key"],
        (_, "link") => &["id", "to"],
        (_, "output") => &["id"],
        _ => &[],
    };
    if attributes
        .keys()
        .any(|key| !allowed.contains(&key.as_str()))
    {
        return Err(invalid(
            Code::BuildInvalid,
            "unknown fragment marker attribute",
        ));
    }
    let id = attributes
        .get("id")
        .filter(|id| !id.is_empty())
        .ok_or_else(|| invalid(Code::BuildInvalid, "fragment marker has no id"))?
        .clone();
    Ok(Some(Marker {
        kind: kind.into(),
        start: phase == "start",
        id,
        attributes,
    }))
}

fn attributes_of(source: &str) -> Result<BTreeMap<String, String>> {
    mokly_catalogue::html_tokens::parse_attributes(source)
        .ok_or_else(|| invalid(Code::BuildInvalid, "malformed fragment marker attributes"))
}

pub(crate) fn required<'a>(marker: &'a Marker, name: &str) -> Result<&'a str> {
    marker
        .attributes
        .get(name)
        .map(String::as_str)
        .ok_or_else(|| invalid(Code::BuildInvalid, format!("fragment marker lacks {name}")))
}
