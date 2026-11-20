//! Each external stylesheet input keeps its own admitting dependency folder.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

pub(crate) fn admitted(
    repository: &Path,
    files: &BTreeSet<String>,
    roots: &BTreeMap<String, PathBuf>,
    cache: Option<&Path>,
    namespace: Option<&Path>,
) -> Vec<(PathBuf, Option<PathBuf>)> {
    files
        .iter()
        .filter_map(|file| {
            let path = repository.join(file);
            let root = roots.get(file);
            if path.starts_with(repository) {
                return Some((path, root.cloned()));
            }
            let root = root?;
            let cache = cache?;
            if !path.starts_with(root)
                || path.starts_with(cache)
                || root.starts_with(cache)
                || namespace.is_some_and(|namespace| {
                    path.starts_with(namespace) || root.starts_with(namespace)
                })
            {
                return None;
            }
            Some((path, Some(root.clone())))
        })
        .collect()
}
