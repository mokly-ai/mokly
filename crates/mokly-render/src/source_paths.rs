//! Logical dependency names preserve source precedence and installation lookup stamps.

use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_compare::ancestor_roots::dependency_directory;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{Node, SourceTree};

/// Private compilation inputs address the installation, independent of source overlays.
pub(crate) const INSTALLED_INPUT_PREFIX: &str = "node_modules/.mokly-roots/installed/";

/// Private witness names keep repository aliases separate from selected package roots.
pub(crate) const SOURCE_INPUT_PREFIX: &str = "node_modules/.mokly-roots/source/";

/// Decode a private repository witness name before package-root selection.
pub(crate) fn repository_input(root: &Path, path: &Path) -> Option<PathBuf> {
    let relative = path
        .strip_prefix(root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    relative
        .strip_prefix(SOURCE_INPUT_PREFIX)
        .map(|name| root.join(name))
}

/// Find an inventoried source for a logical dependency without changing its classification.
pub(crate) fn source_node(
    tree: &dyn SourceTree,
    root: &Path,
    aliases: &BTreeMap<String, String>,
    path: &str,
) -> Result<Option<(PathBuf, Node)>> {
    source_node_with(&|path| tree.project(path), root, aliases, path)
}

/// Resolve one candidate through the same metadata selector used by batches.
pub(crate) fn source_node_with(
    project: &Projection<'_>,
    root: &Path,
    aliases: &BTreeMap<String, String>,
    path: &str,
) -> Result<Option<(PathBuf, Node)>> {
    for candidate in source_candidates(root, aliases, path) {
        if let Some(node) = project(&candidate)?
            && node.identity.starts_with(root)
        {
            return Ok(Some((node.identity.clone(), node)));
        }
    }
    Ok(None)
}

/// One metadata-only projection boundary.
pub(crate) type Projection<'a> = dyn Fn(&Path) -> Result<Option<Node>> + 'a;

/// Ordered repository aliases considered by source selection.
pub(crate) fn source_candidates(
    root: &Path,
    aliases: &BTreeMap<String, String>,
    path: &str,
) -> Vec<PathBuf> {
    if path.starts_with(INSTALLED_INPUT_PREFIX) || dependency_directory(path).is_none() {
        return Vec::new();
    }
    let prefix = aliases
        .values()
        .filter(|prefix| {
            path.strip_prefix(prefix.as_str())
                .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
        })
        .max_by_key(|prefix| prefix.len());
    let mut candidates = match prefix {
        Some(prefix) => aliases
            .iter()
            .filter(|(_, logical)| *logical == prefix)
            .map(|(source, _)| {
                format!(
                    "{source}{}",
                    path.strip_prefix(prefix.as_str()).unwrap_or_default()
                )
            })
            .collect::<Vec<_>>(),
        None => vec![path.into()],
    };
    candidates.sort_by_key(|path| Reverse(path.len()));
    candidates
        .into_iter()
        .map(|candidate| root.join(candidate))
        .collect()
}
