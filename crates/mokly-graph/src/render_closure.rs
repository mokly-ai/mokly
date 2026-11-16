//! Module closures, resolution file chains, and handle modules over one module graph.

use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet};
use std::iter;

use crate::key::{NodeKey, NodeKind, encoded_key};

/// Resolution file names that a module's directory chain can read.
const RESOLUTION_FILES: [&str; 2] = ["package.json", "tsconfig.json"];

/// The module and every module that it imports, directly or through other modules.
pub(crate) fn closure(
    modules: &BTreeMap<String, Vec<String>>,
    roots: impl IntoIterator<Item = String>,
) -> BTreeSet<String> {
    additional(modules, roots, &BTreeSet::new())
}

/// Walk only members outside an already complete shared closure, including cycles.
pub(crate) fn additional(
    modules: &BTreeMap<String, Vec<String>>,
    roots: impl IntoIterator<Item = String>,
    shared: &BTreeSet<String>,
) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    let mut stack: Vec<String> = roots.into_iter().collect();
    while let Some(module) = stack.pop() {
        if shared.contains(&module) || !found.insert(module.clone()) {
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

/// JSON records encoded once for the complete build, including unnamed imports.
pub(crate) struct Records<'a> {
    /// Module path and optional content-record digest, in JSON tuple form.
    pub(crate) modules: BTreeMap<&'a str, Vec<u8>>,
    /// Resolution file name and digest, in JSON tuple form.
    pub(crate) resolution: BTreeMap<&'a str, Vec<u8>>,
    /// Exported or declared binding tuples, in handle order within each module.
    pub(crate) bindings: BTreeMap<&'a str, Vec<Vec<u8>>>,
    /// Resolution candidates for graph members only.
    pub(crate) chains: BTreeMap<&'a str, Vec<String>>,
}

impl Records<'_> {
    /// Collect sorted records for one shared closure or an entry's additional members.
    pub(crate) fn parts(&self, members: BTreeSet<String>) -> Parts<'_> {
        let modules = members
            .iter()
            .filter_map(|path| self.modules.get_key_value(path.as_str()))
            .map(|(path, record)| (*path, record.as_slice()))
            .collect();
        let bindings = members
            .iter()
            .filter_map(|path| self.bindings.get_key_value(path.as_str()))
            .map(|(path, bindings)| (*path, bindings.as_slice()))
            .collect();
        let resolution: BTreeSet<_> = members
            .iter()
            .filter_map(|path| self.chains.get(path.as_str()))
            .flatten()
            .filter_map(|name| self.resolution.get_key_value(name.as_str()))
            .map(|(name, record)| (*name, record.as_slice()))
            .collect();
        Parts {
            members,
            modules,
            bindings,
            resolution: resolution.into_iter().collect(),
        }
    }
}

/// Sorted closure records that can be merged without rebuilding the shared sets.
pub(crate) struct Parts<'a> {
    /// Complete members of this closure, used to stop an entry's additional walk.
    pub(crate) members: BTreeSet<String>,
    modules: Vec<(&'a str, &'a [u8])>,
    bindings: Vec<(&'a str, &'a [Vec<u8>])>,
    resolution: Vec<(&'a str, &'a [u8])>,
}

impl Parts<'_> {
    /// Merge additional inputs in the original array order and canonical field order.
    /// The shared digest is lowercase hexadecimal, so its JSON string needs no escaping.
    pub(crate) fn key(&self, extra: &Self, shared: &str) -> NodeKey {
        encoded_key(NodeKind::RenderInputs, |output| {
            output.extend_from_slice(b"{\"bindings\":");
            array(
                output,
                merge(&self.bindings, &extra.bindings)
                    .flat_map(|(_, bindings)| bindings.iter().map(Vec::as_slice)),
            );
            output.extend_from_slice(b",\"modules\":");
            array(
                output,
                merge(&self.modules, &extra.modules).map(|(_, record)| record),
            );
            output.extend_from_slice(b",\"resolution\":");
            array(
                output,
                merge(&self.resolution, &extra.resolution).map(|(_, record)| record),
            );
            output.extend_from_slice(b",\"shared\":\"");
            output.extend_from_slice(shared.as_bytes());
            output.extend_from_slice(b"\"}");
        })
    }
}

/// Merge sorted records by name, retaining one copy when both parts contain a name.
fn merge<'a, T: Copy>(
    left: &'a [(&'a str, T)],
    right: &'a [(&'a str, T)],
) -> impl Iterator<Item = (&'a str, T)> {
    let mut left = left.iter().copied().peekable();
    let mut right = right.iter().copied().peekable();
    iter::from_fn(move || match (left.peek(), right.peek()) {
        (Some((a, _)), Some((b, _))) => match a.cmp(b) {
            Ordering::Less => left.next(),
            Ordering::Greater => right.next(),
            Ordering::Equal => {
                right.next();
                left.next()
            }
        },
        (Some(_), None) => left.next(),
        (None, _) => right.next(),
    })
}

fn array<'a>(output: &mut Vec<u8>, records: impl IntoIterator<Item = &'a [u8]>) {
    output.push(b'[');
    for (index, record) in records.into_iter().enumerate() {
        if index != 0 {
            output.push(b',');
        }
        output.extend_from_slice(record);
    }
    output.push(b']');
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
