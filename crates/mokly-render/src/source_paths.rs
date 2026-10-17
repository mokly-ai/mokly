//! Logical dependency names preserve source precedence and installation lookup stamps.

use std::cmp::Reverse;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_compare::ancestor_roots::dependency_directory;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::{Node, SourceTree};

/// Private compilation inputs address the installation, independent of source overlays.
pub(crate) const INSTALLED_INPUT_PREFIX: &str = "node_modules/.mokly-roots/installed/";

/// Find an inventoried source for a logical dependency without changing its classification.
pub(crate) fn source_node(
    tree: &dyn SourceTree,
    root: &Path,
    aliases: &BTreeMap<String, String>,
    path: &str,
) -> Result<Option<(PathBuf, Node)>> {
    if path.starts_with(INSTALLED_INPUT_PREFIX) || dependency_directory(path).is_none() {
        return Ok(None);
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
    for candidate in candidates {
        if let Some(node) = tree.project(&root.join(candidate))?
            && node.identity.starts_with(root)
        {
            return Ok(Some((node.identity.clone(), node)));
        }
    }
    Ok(None)
}
