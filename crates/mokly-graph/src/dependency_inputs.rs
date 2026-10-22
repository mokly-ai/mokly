//! Recover authored dependency directories from completed bundle inputs.

use std::collections::BTreeMap;

pub(crate) fn directory(path: &str, aliases: &BTreeMap<String, String>) -> Option<String> {
    let prefix = if let Some(rest) = path.strip_prefix("node_modules/.mokly-roots/") {
        let (index, _) = rest.split_once('/')?;
        format!("node_modules/.mokly-roots/{index}")
    } else if path.starts_with("node_modules/") {
        "node_modules".into()
    } else {
        let parts: Vec<_> = path.split('/').collect();
        if parts
            .iter()
            .any(|part| matches!(*part, "" | "." | "..") || part.contains('\\'))
        {
            return None;
        }
        let index = parts.iter().position(|part| *part == "node_modules")?;
        return Some(parts[..=index].join("/"));
    };
    aliases
        .iter()
        .filter(|(_, logical)| **logical == prefix)
        .max_by_key(|(authored, _)| authored.len())
        .map(|(authored, _)| authored.clone())
}

#[cfg(test)]
#[path = "_tests_/dependency_inputs_tests.rs"]
mod dependency_inputs_tests;
