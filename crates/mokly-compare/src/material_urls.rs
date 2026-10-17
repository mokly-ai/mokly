//! Canonical resource references retain query and fragment while removing relative spelling.

use std::collections::BTreeMap;

use mokly_css::syntax;
use mokly_graph::urls::local_target;

pub(crate) fn url(value: &str, source: &str, aliases: &BTreeMap<String, String>) -> String {
    match local_target(source, value) {
        Ok(Some(route)) => {
            let suffix = value.find(['?', '#']).map_or("", |index| &value[index..]);
            format!("{}{suffix}", aliases.get(&route).unwrap_or(&route))
        }
        _ => value.into(),
    }
}

pub(crate) fn css(value: &str, source: &str, aliases: &BTreeMap<String, String>) -> String {
    let mut result = value.to_owned();
    for reference in syntax::references(value).into_iter().rev() {
        let normalized = url(&reference.value, source, aliases);
        let escaped = normalized.replace('\\', "\\\\").replace('"', "\\\"");
        if result.get(reference.start..reference.end).is_some() {
            result.replace_range(
                reference.start..reference.end,
                &format!("url(\"{escaped}\")"),
            );
        }
    }
    result
}

pub(crate) fn srcset(value: &str, source: &str, aliases: &BTreeMap<String, String>) -> String {
    let mut rest = value;
    let mut candidates = Vec::new();
    while !rest.trim_start().is_empty() {
        rest = rest.trim_start_matches(|character: char| {
            character.is_ascii_whitespace() || character == ','
        });
        let end = rest
            .find(|character: char| character.is_ascii_whitespace())
            .unwrap_or(rest.len());
        let target = &rest[..end];
        rest = &rest[end..];
        let target = target.trim_end_matches(',');
        if target.is_empty() {
            continue;
        }
        let normalized = url(target, source, aliases);
        if value[..value.len() - rest.len()].ends_with(',') {
            candidates.push(normalized);
            continue;
        }
        let (descriptors, remaining) = rest.split_once(',').unwrap_or((rest, ""));
        let descriptors = descriptors
            .split_ascii_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        candidates.push(if descriptors.is_empty() {
            normalized
        } else {
            format!("{normalized} {descriptors}")
        });
        rest = remaining;
    }
    candidates.join(", ")
}
