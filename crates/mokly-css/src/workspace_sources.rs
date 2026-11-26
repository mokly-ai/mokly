//! Match built package targets to source paths inside the selected tree.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};
use serde::Deserialize;

use crate::resolution::Resolution;
use crate::workspace_tsconfig;

/// Select a source file and retain build target probes for configured layouts.
pub(crate) fn source(
    tree: &dyn SourceTree,
    repo_root: &Path,
    target: &Path,
    settings: &Resolution,
) -> Option<PathBuf> {
    let (package, name) = package_root(tree, repo_root, target)?;
    let relative = target.strip_prefix(package).ok()?;
    let mut layouts = settings
        .source_packages
        .iter()
        .filter_map(|entries| entries.get(&name))
        .peekable();
    if layouts.peek().is_some() {
        let _ = tree.project(target);
    }
    for layout in layouts {
        let Some(folders) = layout else {
            return None;
        };
        if let Some(candidate) = override_path(package, relative, folders)
            && let Some(source) = source_file(tree, repo_root, &candidate, settings)
        {
            return Some(source);
        }
    }

    let (build, source) = match workspace_tsconfig::folders(tree, repo_root, package) {
        Some(folders) => folders,
        None => {
            let top = relative.iter().next()?;
            if !["dist", "lib", "build", "out"]
                .iter()
                .any(|folder| top == *folder)
            {
                return None;
            }
            (package.join(top), package.join("src"))
        }
    };
    let suffix = target.strip_prefix(build).ok()?;
    if suffix.as_os_str().is_empty() {
        return None;
    }
    source_file(tree, repo_root, &source.join(suffix), settings)
}

fn override_path(
    package: &Path,
    target: &Path,
    folders: &BTreeMap<String, String>,
) -> Option<PathBuf> {
    let (_, source, suffix) = folders
        .iter()
        .filter_map(|(build, source)| {
            let suffix = target.strip_prefix(build).ok()?;
            (!suffix.as_os_str().is_empty()).then_some((build.len(), source, suffix))
        })
        .max_by_key(|(length, _, _)| *length)?;
    Some(if source == "." {
        package.join(suffix)
    } else {
        package.join(source).join(suffix)
    })
}

fn source_file(
    tree: &dyn SourceTree,
    repo_root: &Path,
    candidate: &Path,
    settings: &Resolution,
) -> Option<PathBuf> {
    if !matches!(
        candidate.extension().and_then(|value| value.to_str()),
        Some("js" | "mjs" | "cjs")
    ) {
        return regular_file(tree, repo_root, candidate);
    }
    let stem = candidate.with_extension("").into_os_string();
    settings
        .extension_order()
        .filter(|extension| {
            extension.rsplit_once('.').is_some_and(|(_, suffix)| {
                matches!(
                    suffix,
                    "tsx" | "ts" | "jsx" | "js" | "mts" | "cts" | "mjs" | "cjs"
                )
            })
        })
        .find_map(|extension| {
            let mut candidate = stem.clone();
            candidate.push(extension);
            regular_file(tree, repo_root, Path::new(&candidate))
        })
}

#[derive(Deserialize)]
struct PackageName {
    name: String,
}

/// Read the nearest repository package name for a target on this side.
pub fn workspace_package_name(
    tree: &dyn SourceTree,
    repo_root: &Path,
    target: &Path,
) -> Option<String> {
    package_root(tree, repo_root, target).map(|(_, name)| name)
}

fn package_root<'a>(
    tree: &dyn SourceTree,
    repo_root: &Path,
    target: &'a Path,
) -> Option<(&'a Path, String)> {
    if !repository_path(repo_root, target) {
        return None;
    }
    for directory in target
        .parent()?
        .ancestors()
        .take_while(|directory| directory.starts_with(repo_root))
    {
        if let Some(manifest) = regular_file(tree, repo_root, &directory.join("package.json")) {
            let bytes = tree.read(&manifest).ok()?;
            let text = str::from_utf8(&bytes).ok()?.trim_start_matches('\u{feff}');
            let package: PackageName = serde_json::from_str(text).ok()?;
            return (!package.name.is_empty()).then_some((directory, package.name));
        }
    }
    None
}

/// Test the repository boundary before applying the source rule.
pub(crate) fn repository_path(repo_root: &Path, file: &Path) -> bool {
    file.strip_prefix(repo_root).is_ok_and(|relative| {
        relative
            .iter()
            .all(|part| part != "node_modules" && part != "..")
    })
}

/// Probe a confined file through the side's tree and keep its canonical identity.
pub(crate) fn regular_file(
    tree: &dyn SourceTree,
    repo_root: &Path,
    path: &Path,
) -> Option<PathBuf> {
    if !repository_path(repo_root, path) {
        return None;
    }
    let node = tree.project(path).ok()??;
    (node.kind == FileKind::File && repository_path(repo_root, &node.identity))
        .then_some(node.identity)
}

#[cfg(test)]
#[path = "_tests_/workspace_sources_tests.rs"]
mod workspace_sources_tests;
