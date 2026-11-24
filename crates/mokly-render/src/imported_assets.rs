//! Project asset-default loads into the selected side's delivery inputs.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_css::types::OpaqueAsset;
use mokly_graph::delivery_inputs::ImportedAsset;
use mokly_source_interface::error::SourceError;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, Result};

pub(crate) fn prepare(
    tree: &dyn SourceTree,
    root: &Path,
    generation: &JavaScriptGeneration,
) -> Result<Vec<ImportedAsset>> {
    if generation.imported_assets.is_empty() {
        return Ok(Vec::new());
    }
    let mut importers = BTreeMap::new();
    for (module, imports) in &generation.modules {
        for path in imports {
            if generation.imported_assets.contains(path) {
                importers.entry(path).or_insert(module.as_str());
            }
        }
    }
    generation
        .imported_assets
        .iter()
        .filter_map(|path| {
            let digest = generation.module_digests.get(path)?.as_deref()?;
            let module = importers.get(path).copied().unwrap_or(path);
            Some(project(tree, root, path, digest, module))
        })
        .collect()
}

fn project(
    tree: &dyn SourceTree,
    root: &Path,
    path: &str,
    digest: &str,
    module: &str,
) -> Result<ImportedAsset> {
    let candidate = root.join(path);
    let node = match tree.project(&candidate) {
        Ok(node) => node,
        Err(source) => return Err(InternalError::Source { source }.into()),
    };
    let Some(node) =
        node.filter(|node| node.kind == FileKind::File && node.identity.starts_with(root))
    else {
        return Err(InternalError::Source {
            source: SourceError::Changed { path: candidate },
        }
        .into());
    };
    let aliases = node
        .identity
        .strip_prefix(root)
        .ok()
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .filter(|relative| relative != path)
        .into_iter()
        .collect();
    Ok(ImportedAsset {
        asset: OpaqueAsset {
            path: path.into(),
            source: node.identity,
            digest: digest.into(),
            aliases,
        },
        module: module.into(),
    })
}
