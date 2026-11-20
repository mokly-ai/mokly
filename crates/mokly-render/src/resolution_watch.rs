//! Captured logical probes become exact physical watch paths on the selected side.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use mokly_css::watch_inputs::WatchInputs;
use mokly_source_interface::error::Result;
use mokly_source_interface::tree::SourceTree;

use crate::side::SideInputs;
use crate::source_paths::INSTALLED_INPUT_PREFIX;
use crate::watch_candidate::optional;

#[derive(Default)]
pub(crate) struct Projection {
    pub(crate) inputs: WatchInputs,
    pub(crate) paths: BTreeMap<String, BTreeSet<String>>,
}

pub(crate) fn inputs(
    logical: &BTreeSet<String>,
    root: &Path,
    side: &SideInputs,
    sources: &dyn SourceTree,
) -> Result<Projection> {
    let mut result = Projection::default();
    let mut repairs = WatchInputs::default();
    for logical in logical {
        let paths = result.paths.entry(logical.clone()).or_default();
        let relative = logical
            .strip_prefix(INSTALLED_INPUT_PREFIX)
            .unwrap_or(logical);
        if relative == "node_modules/.mokly-roots" {
            continue;
        }
        for candidate in side.watch_candidates(relative, sources, root)? {
            let written_root = candidate.dependency_root.as_ref().map(|root| {
                candidate
                    .path
                    .strip_prefix(root)
                    .ok()
                    .and_then(|relative| {
                        relative.ancestors().find(|ancestor| {
                            ancestor
                                .file_name()
                                .is_some_and(|name| name == "node_modules")
                        })
                    })
                    .map_or_else(|| root.clone(), |nested| root.join(nested))
            });
            let dependency_root = match &written_root {
                Some(root) => canonical_candidate(sources, root)?,
                None => None,
            };
            paths.extend(insert(
                &mut result.inputs,
                root,
                &candidate.path,
                written_root.as_deref(),
            ));
            if let Some(canonical) = canonical_candidate(sources, &candidate.path)? {
                paths.extend(insert(
                    &mut result.inputs,
                    root,
                    &canonical,
                    dependency_root.as_deref(),
                ));
            }
            if let Some(boundary) = candidate.dependency_root {
                nested_repairs(&mut repairs, root, &candidate.path, &boundary, sources)?;
            }
        }
    }
    result.inputs.files.extend(repairs.files);
    result
        .inputs
        .dependency_roots
        .extend(repairs.dependency_roots);
    Ok(result)
}

/// Repair paths observe each nested link from its containing installation.
fn nested_repairs(
    repairs: &mut WatchInputs,
    root: &Path,
    path: &Path,
    boundary: &Path,
    sources: &dyn SourceTree,
) -> Result<()> {
    for nested in path.ancestors().filter(|ancestor| {
        *ancestor != boundary
            && ancestor.starts_with(boundary)
            && ancestor
                .file_name()
                .is_some_and(|name| name == "node_modules")
    }) {
        insert(repairs, root, nested, Some(boundary));
        let Some(parent) = nested.parent() else {
            continue;
        };
        let containing = parent
            .ancestors()
            .find(|ancestor| {
                ancestor.starts_with(boundary)
                    && ancestor
                        .file_name()
                        .is_some_and(|name| name == "node_modules")
            })
            .unwrap_or(boundary);
        if let Some(parent) = canonical_candidate(sources, parent)?
            && let Some(containing) = canonical_candidate(sources, containing)?
        {
            insert(
                repairs,
                root,
                &parent.join("node_modules"),
                Some(&containing),
            );
        }
    }
    Ok(())
}

fn canonical_candidate(sources: &dyn SourceTree, path: &Path) -> Result<Option<PathBuf>> {
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

fn insert(
    inputs: &mut WatchInputs,
    root: &Path,
    path: &Path,
    dependency_root: Option<&Path>,
) -> Option<String> {
    if !path.starts_with(root)
        && !dependency_root.is_some_and(|dependency_root| path.starts_with(dependency_root))
    {
        return None;
    }
    let name = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    inputs.files.insert(name.clone());
    if let Some(dependency_root) = dependency_root {
        inputs
            .dependency_roots
            .insert(name.clone(), dependency_root.into());
    }
    Some(name)
}
