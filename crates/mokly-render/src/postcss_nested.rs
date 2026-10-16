//! Renderer exclusion checks run before plugin dependency inventory validation.

use std::collections::BTreeSet;
use std::path::Path;

use mokly_css::resolver::ImportResolver;
use mokly_css::{paths, syntax};
use mokly_sidecar::results::{Dependency, DependencyKind};
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{InternalError, RenderError, Result};
use crate::postcss_inventory::normalize;
use crate::side::SideInputs;

pub(crate) struct Input<'a> {
    pub(crate) tree: &'a dyn SourceTree,
    pub(crate) resolver: &'a dyn ImportResolver,
    pub(crate) root: &'a Path,
    pub(crate) side: &'a SideInputs,
    pub(crate) path: &'a str,
    pub(crate) source: &'a str,
    pub(crate) excluded: &'a BTreeSet<String>,
    pub(crate) dependencies: &'a [Dependency],
}

pub(crate) fn validate(input: &Input<'_>) -> Result<()> {
    for dependency in input
        .dependencies
        .iter()
        .filter(|dependency| matches!(dependency.kind, DependencyKind::File))
    {
        let physical = Path::new(&dependency.path);
        let physical = if physical.is_absolute() {
            physical.to_owned()
        } else {
            input
                .side
                .physical_source(input.path)
                .parent()
                .unwrap_or(&input.side.source_root)
                .join(physical)
        };
        let physical = normalize(&physical);
        let logical = input.side.logical_dependency(&physical).or_else(|| {
            physical
                .strip_prefix(&input.side.source_root)
                .ok()
                .map(|path| path.to_string_lossy().replace('\\', "/"))
        });
        let Some(target) = logical.filter(|path| input.excluded.contains(path)) else {
            continue;
        };
        if let Some(intermediate) = find(
            input,
            input.path,
            input.source,
            &target,
            0,
            &mut BTreeSet::new(),
        )? {
            return Err(RenderError::NestedImport {
                plugin: dependency
                    .plugin
                    .clone()
                    .unwrap_or_else(|| "unknown".into()),
                stylesheet: input.path.into(),
                excluded: target,
                intermediate,
            });
        }
    }
    Ok(())
}

fn find(
    input: &Input<'_>,
    path: &str,
    source: &str,
    target: &str,
    depth: usize,
    seen: &mut BTreeSet<String>,
) -> Result<Option<String>> {
    if !seen.insert(path.into()) {
        return Ok(None);
    }
    for reference in syntax::references(source)
        .into_iter()
        .filter(|reference| reference.import && !paths::external(&reference.value))
    {
        let imported = match input.resolver.resolve(path, &reference.value) {
            Ok(imported) => imported,
            Err(source) => return Err(RenderError::Css { source }),
        };
        if imported == target {
            if depth > 0 {
                return Ok(Some(path.into()));
            }
            continue;
        }
        if input.excluded.contains(&imported) {
            continue;
        }
        let node = match input.tree.project(&input.root.join(&imported)) {
            Ok(node) => node,
            Err(source) => return Err(InternalError::Source { source }.into()),
        };
        let Some(node) = node
            .filter(|node| node.kind == FileKind::File && node.identity.starts_with(input.root))
        else {
            continue;
        };
        let bytes = match input.tree.read(&node.identity) {
            Ok(bytes) => bytes,
            Err(source) => return Err(InternalError::Source { source }.into()),
        };
        if let Ok(source) = String::from_utf8(bytes)
            && let Some(parent) = find(input, &imported, &source, target, depth + 1, seen)?
        {
            return Ok(Some(parent));
        }
    }
    Ok(None)
}
