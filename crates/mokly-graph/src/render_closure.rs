//! Module closures, resolution file chains, and handle modules over one module graph.

use std::collections::{BTreeMap, BTreeSet};

/// Resolution file names that a module's directory chain can read.
const RESOLUTION_FILES: [&str; 2] = ["package.json", "tsconfig.json"];

/// The module and every module that it imports, directly or through other modules.
pub(crate) fn closure(
    modules: &BTreeMap<String, Vec<String>>,
    roots: impl IntoIterator<Item = String>,
) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut stack: Vec<String> = roots.into_iter().collect();
    while let Some(module) = stack.pop() {
        if !found.insert(module.clone()) {
            continue;
        }
        if let Some(imports) = modules.get(&module) {
            stack.extend(
                imports
                    .iter()
                    .filter(|import| !found.contains(*import))
                    .cloned(),
            );
        }
    }
    found
}

/// The resolution file candidates in a module's directory and its parents, up to its root.
///
/// The root is the source root for a source-relative name, or the selected dependency
/// root that the name's logical prefix gives.
pub(crate) fn chain(path: &str) -> Vec<String> {
    let root = logical_root(path);
    let mut directory = parent(path);
    let mut candidates = Vec::new();
    loop {
        for file in RESOLUTION_FILES {
            candidates.push(if directory.is_empty() {
                file.to_owned()
            } else {
                format!("{directory}/{file}")
            });
        }
        if directory.len() <= root.len() {
            return candidates;
        }
        directory = parent(directory);
    }
}

/// The entry module of a definition, story, or saved slot handle.
///
/// A module path can contain `#`, so the longest known module before a `#` wins.
pub(crate) fn handle_module<'a>(
    modules: &BTreeMap<String, Vec<String>>,
    handle: &'a str,
) -> Option<&'a str> {
    handle
        .match_indices('#')
        .rev()
        .map(|(index, _)| &handle[..index])
        .find(|module| modules.contains_key(*module))
}

fn logical_root(path: &str) -> &str {
    if let Some(rest) = path.strip_prefix("node_modules/.mokly-roots/") {
        let index = rest.split('/').next().unwrap_or_default();
        &path[.."node_modules/.mokly-roots/".len() + index.len()]
    } else if path.starts_with("node_modules/") {
        "node_modules"
    } else {
        ""
    }
}

fn parent(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(directory, _)| directory)
}

#[cfg(test)]
#[path = "_tests_/render_closure_tests.rs"]
mod render_closure_tests;
