//! Captured logical probes become exact physical watch paths on the selected side.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use mokly_css::error::{InternalError, Result};
use mokly_css::watch_inputs::WatchInputs;
use mokly_source_interface::error;
use mokly_source_interface::tree::SourceTree;

use crate::side::SideInputs;
use crate::watch_candidate::optional;

pub(crate) fn files(
    logical: &BTreeSet<String>,
    root: &Path,
    side: &SideInputs,
    sources: &dyn SourceTree,
) -> Result<WatchInputs> {
    match mapped(logical, root, side, sources) {
        Ok(inputs) => Ok(inputs),
        Err(source) => Err(InternalError::Provider {
            source: Box::new(source),
        }
        .into()),
    }
}

fn mapped(
    logical: &BTreeSet<String>,
    root: &Path,
    side: &SideInputs,
    sources: &dyn SourceTree,
) -> error::Result<WatchInputs> {
    let mut inputs = WatchInputs::default();
    for relative in logical {
        if relative == "node_modules/.mokly-roots" {
            continue;
        }
        for candidate in side.watch_candidates(relative, sources, root)? {
            let dependency_root = match candidate.dependency_root {
                Some(dependency_root) => canonical_candidate(sources, &dependency_root)?,
                None => None,
            };
            insert(
                &mut inputs,
                root,
                &candidate.path,
                dependency_root.as_deref(),
            );
            if let Some(canonical) = canonical_candidate(sources, &candidate.path)? {
                insert(&mut inputs, root, &canonical, dependency_root.as_deref());
            }
        }
    }
    Ok(inputs)
}

fn canonical_candidate(sources: &dyn SourceTree, path: &Path) -> error::Result<Option<PathBuf>> {
    for ancestor in path.ancestors() {
        if let Some(Some(node)) = optional(sources.project(ancestor))? {
            let relative = path.strip_prefix(ancestor).unwrap_or(path);
            return Ok(Some(if relative.as_os_str().is_empty() {
                node.identity
            } else {
                node.identity.join(relative)
            }));
        }
    }
    Ok(None)
}

fn insert(inputs: &mut WatchInputs, root: &Path, path: &Path, dependency_root: Option<&Path>) {
    if !path.starts_with(root)
        && !dependency_root.is_some_and(|dependency_root| path.starts_with(dependency_root))
    {
        return;
    }
    let name = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    inputs.files.insert(name.clone());
    if let Some(dependency_root) = dependency_root {
        inputs.dependency_roots.insert(name, dependency_root.into());
    }
}
