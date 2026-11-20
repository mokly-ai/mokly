//! Captured logical probes become exact physical watch paths on the selected side.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_css::error::{InternalError, Result};
use mokly_source_interface::tree::SourceTree;

use crate::side::SideInputs;

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
        let candidates = match side.watch_candidates(relative, sources, root) {
            Ok(candidates) => candidates,
            Err(source) => {
                return Err(InternalError::Provider {
                    source: Box::new(source),
                }
                .into());
            }
        };
        for candidate in candidates {
            insert(&mut files, root, &candidate);
            if let Some(canonical) = canonical_candidate(sources, &candidate)? {
                insert(&mut files, root, &canonical);
            }
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
