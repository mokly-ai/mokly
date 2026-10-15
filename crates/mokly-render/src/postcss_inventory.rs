//! Confined dependency files and directory globs reported by consumer plugins.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_catalogue::config::relative;
use mokly_css::dependencies::{DirectoryDependency, PluginInput};
use mokly_model::canonical::compare_utf16;
use mokly_sidecar::results::{Dependency, DependencyKind};
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{DependencyFailure, RenderError, Result};
use crate::postcss_scan::Scan;

pub(crate) struct Inventory {
    pub(crate) inputs: BTreeMap<String, String>,
    pub(crate) plugin_inputs: BTreeMap<String, PluginInput>,
    pub(crate) directories: Vec<DirectoryDependency>,
}

pub(crate) fn collect(
    tree: &dyn SourceTree,
    scan: &mut Scan,
    root: &Path,
    physical_root: &Path,
    stylesheet: &str,
    mut dependencies: Vec<Dependency>,
) -> Result<Inventory> {
    dependencies.sort_by(|a, b| {
        matches!(a.kind, DependencyKind::Directory)
            .cmp(&matches!(b.kind, DependencyKind::Directory))
            .then_with(|| compare_utf16(&a.path, &b.path))
    });
    let mut inputs = Inventory {
        inputs: BTreeMap::new(),
        plugin_inputs: BTreeMap::new(),
        directories: Vec::new(),
    };
    for dependency in dependencies {
        let reported = PathBuf::from(&dependency.path);
        let physical = if reported.is_absolute() {
            reported
        } else {
            physical_root
                .join(Path::new(stylesheet).parent().unwrap_or(Path::new("")))
                .join(reported)
        };
        let physical = normalize(&physical);
        let Ok(logical) = physical.strip_prefix(physical_root) else {
            continue;
        };
        let path = root.join(logical);
        if matches!(dependency.kind, DependencyKind::File)
            && inputs.inputs.contains_key(&relative(&path, root))
        {
            continue;
        }
        let origin = PluginInput {
            plugin: dependency
                .plugin
                .clone()
                .unwrap_or_else(|| "unknown".into()),
            stylesheet: stylesheet.into(),
        };
        let projected = scan.project(tree, &path)?;
        let Some(node) = projected else {
            return Err(failure(
                &dependency,
                stylesheet,
                &relative(&path, root),
                if matches!(dependency.kind, DependencyKind::File) {
                    DependencyFailure::File
                } else {
                    DependencyFailure::Directory
                },
            ));
        };
        if !node.identity.starts_with(root)
            || node
                .identity
                .components()
                .any(|part| part.as_os_str() == "node_modules")
        {
            continue;
        }
        match dependency.kind {
            DependencyKind::File => {
                if node.kind != FileKind::File {
                    return Err(failure(
                        &dependency,
                        stylesheet,
                        &relative(&path, root),
                        DependencyFailure::File,
                    ));
                }
                read(
                    tree,
                    scan,
                    root,
                    &path,
                    &node.identity,
                    &origin,
                    &mut inputs,
                )?;
            }
            DependencyKind::Directory => {
                if node.kind != FileKind::Directory {
                    return Err(failure(
                        &dependency,
                        stylesheet,
                        &relative(&path, root),
                        DependencyFailure::Directory,
                    ));
                }
                for watch in [&path, &node.identity] {
                    let record = DirectoryDependency {
                        path: relative(watch, root),
                        glob: dependency.glob.clone().unwrap_or_else(|| "**/*".into()),
                        origin: origin.clone(),
                    };
                    if !inputs.directories.contains(&record) {
                        inputs.directories.push(record);
                    }
                }
                let files = scan.matching_files(
                    tree,
                    &node.identity,
                    dependency.glob.as_deref().unwrap_or("**/*"),
                    &|| {
                        failure(
                            &dependency,
                            stylesheet,
                            &relative(&path, root),
                            DependencyFailure::Glob,
                        )
                    },
                )?;
                for suffix in files.iter() {
                    read(
                        tree,
                        scan,
                        root,
                        &path.join(suffix),
                        &node.identity.join(suffix),
                        &origin,
                        &mut inputs,
                    )?;
                }
            }
        }
    }
    Ok(inputs)
}

fn read(
    tree: &dyn SourceTree,
    scan: &mut Scan,
    root: &Path,
    path: &Path,
    identity: &Path,
    origin: &PluginInput,
    inputs: &mut Inventory,
) -> Result<()> {
    let name = relative(path, root);
    if inputs.inputs.contains_key(&name) {
        return Ok(());
    }
    let digest = scan.digest(tree, identity)?;
    inputs.plugin_inputs.insert(name.clone(), origin.clone());
    inputs
        .plugin_inputs
        .insert(relative(identity, root), origin.clone());
    inputs.inputs.insert(name, digest.clone());
    inputs.inputs.insert(relative(identity, root), digest);
    Ok(())
}

fn failure(
    dependency: &Dependency,
    stylesheet: &str,
    path: &str,
    reason: DependencyFailure,
) -> RenderError {
    RenderError::Dependency {
        stylesheet: stylesheet.into(),
        plugin: dependency
            .plugin
            .clone()
            .unwrap_or_else(|| "unknown".into()),
        path: path.into(),
        reason,
    }
}

pub(crate) fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for part in path.components() {
        if part == std::path::Component::ParentDir {
            result.pop();
        } else if part != std::path::Component::CurDir {
            result.push(part);
        }
    }
    result
}
