//! Confined dependency files and directory globs reported by consumer plugins.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use globset::GlobBuilder;
use mokly_catalogue::config::relative;
use mokly_css::dependencies::{DirectoryDependency, PluginInput};
use mokly_model::canonical::compare_utf16;
use mokly_sidecar::results::{Dependency, DependencyKind};
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::error::{DependencyFailure, InternalError, RenderError, Result};

pub(crate) struct Inventory {
    pub(crate) inputs: BTreeMap<String, Vec<u8>>,
    pub(crate) plugin_inputs: BTreeMap<String, PluginInput>,
    pub(crate) directories: Vec<DirectoryDependency>,
}

pub(crate) fn collect(
    tree: &dyn SourceTree,
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
        let projected = match tree.project(&path) {
            Ok(node) => node,
            Err(source) => return Err(InternalError::Source { source }.into()),
        };
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
                read(tree, root, &path, &node.identity, &origin, &mut inputs)?;
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
                let glob = match GlobBuilder::new(dependency.glob.as_deref().unwrap_or("**/*"))
                    .literal_separator(true)
                    .backslash_escape(false)
                    .build()
                {
                    Ok(glob) => glob.compile_matcher(),
                    Err(_) => {
                        return Err(failure(
                            &dependency,
                            stylesheet,
                            &relative(&path, root),
                            DependencyFailure::Glob,
                        ));
                    }
                };
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
                let mut pending = vec![(node.identity.clone(), PathBuf::new())];
                while let Some((directory, suffix)) = pending.pop() {
                    let children = match tree.children(&directory) {
                        Ok(children) => children,
                        Err(source) => return Err(InternalError::Source { source }.into()),
                    };
                    for child in children {
                        let suffix = suffix.join(&child.name);
                        let file = node.identity.join(&suffix);
                        if child.kind == FileKind::Directory && !denied(&child.name) {
                            pending.push((file, suffix));
                        } else if child.kind == FileKind::File && glob.is_match(&suffix) {
                            read(tree, root, &path.join(&suffix), &file, &origin, &mut inputs)?;
                        }
                    }
                }
            }
        }
    }
    Ok(inputs)
}

fn read(
    tree: &dyn SourceTree,
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
    let bytes = match tree.read(identity) {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Source { source }.into()),
    };
    inputs.plugin_inputs.insert(name.clone(), origin.clone());
    inputs
        .plugin_inputs
        .insert(relative(identity, root), origin.clone());
    inputs.inputs.insert(name, bytes.clone());
    inputs.inputs.insert(relative(identity, root), bytes);
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

fn denied(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "dist"
            | "coverage"
            | "target"
            | "test-results"
            | "playwright-report"
            | ".context"
    )
}
