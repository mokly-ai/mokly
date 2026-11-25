//! Match built package targets to source paths inside the selected tree.

use std::path::{Path, PathBuf};

use mokly_source_interface::tree::{FileKind, SourceTree};
use serde::Deserialize;

use crate::resolution::Resolution;
use crate::workspace_tsconfig;

/// Select the source file for a resolved repository target.
pub(crate) fn source(
    tree: &dyn SourceTree,
    repo_root: &Path,
    target: &Path,
    settings: &Resolution,
) -> Option<PathBuf> {
    if !repository_path(repo_root, target) {
        return None;
    }
    let package = package_root(tree, repo_root, target)?;
    let (build, source) = match workspace_tsconfig::folders(tree, repo_root, package) {
        Some(folders) => folders,
        None => {
            let top = target.strip_prefix(package).ok()?.iter().next()?;
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
    let candidate = source.join(suffix);
    if !matches!(
        candidate.extension().and_then(|value| value.to_str()),
        Some("js" | "mjs" | "cjs")
    ) {
        return regular_file(tree, repo_root, &candidate);
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

fn package_root<'a>(tree: &dyn SourceTree, repo_root: &Path, target: &'a Path) -> Option<&'a Path> {
    for directory in target
        .parent()?
        .ancestors()
        .take_while(|directory| directory.starts_with(repo_root))
    {
        if let Some(manifest) = regular_file(tree, repo_root, &directory.join("package.json")) {
            let bytes = tree.read(&manifest).ok()?;
            let text = str::from_utf8(&bytes).ok()?.trim_start_matches('\u{feff}');
            let package: PackageName = serde_json::from_str(text).ok()?;
            return (!package.name.is_empty()).then_some(directory);
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
