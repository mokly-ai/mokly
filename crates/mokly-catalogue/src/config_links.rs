//! Name unresolved symbolic links in failed configuration path checks.

use std::path::{Component, Path};

use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::config::relative;
use crate::config_validation::invalid;
use crate::error::CatalogueError;

/// Find the first symbolic link on a normalized repository path.
pub(crate) fn unresolved_link(
    tree: &dyn SourceTree,
    path: &Path,
    repo_root: &Path,
) -> Option<String> {
    let suffix = path.strip_prefix(repo_root).ok()?;
    suffix.components().next()?;
    let mut prefix = repo_root.to_owned();
    for component in suffix.components() {
        let Component::Normal(name) = component else {
            return None;
        };
        prefix.push(name);
        match tree.project(&prefix) {
            Ok(Some(node)) if node.kind == FileKind::Symlink => {
                return Some(relative(&prefix, repo_root));
            }
            Ok(Some(node)) if node.kind == FileKind::Directory => {}
            Ok(_) | Err(_) => return None,
        }
    }
    None
}

/// Build the standard configuration error for a path below a symbolic link.
pub(crate) fn link_error(
    tree: &dyn SourceTree,
    path: &Path,
    repo_root: &Path,
    setting: &str,
    value: &str,
) -> Option<CatalogueError> {
    let link = unresolved_link(tree, path, repo_root)?;
    Some(invalid(format!(
        "{setting}: {value} uses the symbolic link {link}; name the target path instead"
    )))
}

#[cfg(test)]
#[path = "_tests_/config_links_tests.rs"]
mod config_links_tests;
