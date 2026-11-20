//! Captured logical probes become exact physical watch paths on the selected side.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_css::error::{InternalError, Result};
use mokly_source_interface::tree::SourceTree;

use crate::side::{SideInputs, dependency_roots};

pub(crate) fn files(
    logical: &BTreeSet<String>,
    root: &Path,
    side: &SideInputs,
    sources: &dyn SourceTree,
) -> Result<BTreeSet<String>> {
    let mut files = BTreeSet::new();
    for relative in logical {
        if relative == "node_modules/.mokly-roots" {
            continue;
        }
        let lexical =
            dependency_candidate(relative, side).unwrap_or_else(|| side.source_root.join(relative));
        insert(&mut files, root, &lexical);
        let virtual_root = relative
            .strip_prefix("node_modules/.mokly-roots/")
            .and_then(|index| index.parse::<usize>().ok())
            .and_then(|index| dependency_roots(side).get(index).cloned());
        let physical = match virtual_root
            .map(Ok)
            .unwrap_or_else(|| side.physical_source(relative, sources, root))
        {
            Ok(physical) => physical,
            Err(source) => {
                return Err(InternalError::Provider {
                    source: Box::new(source),
                }
                .into());
            }
        };
        insert(&mut files, root, &physical);
        if let Some(canonical) = canonical_candidate(sources, &physical)? {
            insert(&mut files, root, &canonical);
        }
    }
    Ok(files)
}

fn canonical_candidate(sources: &dyn SourceTree, path: &Path) -> Result<Option<PathBuf>> {
    for ancestor in path.ancestors() {
        let node = match sources.project(ancestor) {
            Ok(node) => node,
            Err(source) => {
                return Err(InternalError::Provider {
                    source: Box::new(source),
                }
                .into());
            }
        };
        if let Some(node) = node {
            return Ok(Some(
                node.identity
                    .join(path.strip_prefix(ancestor).unwrap_or(path)),
            ));
        }
    }
    Ok(None)
}

fn insert(files: &mut BTreeSet<String>, root: &Path, path: &Path) {
    files.insert(
        path.strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/"),
    );
}

fn dependency_candidate(path: &str, side: &SideInputs) -> Option<PathBuf> {
    let rest = path.strip_prefix("node_modules/")?;
    let (index, rest) = match rest.strip_prefix(".mokly-roots/") {
        Some(rest) => {
            let (index, rest) = rest.split_once('/').unwrap_or((rest, ""));
            (index.parse::<usize>().ok()?, rest)
        }
        None => (0, rest),
    };
    dependency_roots(side)
        .get(index)
        .map(|root| root.join(rest))
}
