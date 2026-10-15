//! Upward config lookup and confined source-tree path resolution.

use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, Node, SourceTree};

use crate::config_paths::validate_inputs;
use crate::config_types::{ResolvedConfig, ResolvedRoot, RootConfig};
use crate::config_validation::{invalid, parse};
use crate::error::{CatalogueError, Result};

/// Configuration loading and source path projection boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ConfigLoaderMock))]
pub trait ConfigLoader: Send + Sync {
    /// Resolve an explicit file or search upward from the supplied directory.
    fn load(&self, cwd: &Path, explicit: Option<&str>) -> Result<ResolvedConfig>;
}

/// Data-only configuration loader, consumed through `dyn ConfigLoader`.
pub struct Loader {
    /// Read-only working-tree or Git-tree source.
    pub tree: Arc<dyn SourceTree>,
}

impl ConfigLoader for Loader {
    fn load(&self, cwd: &Path, explicit: Option<&str>) -> Result<ResolvedConfig> {
        let file = if let Some(path) = explicit {
            normalize(&cwd.join(path))
        } else {
            find(self.tree.as_ref(), cwd)?
        };
        let bytes = match self.tree.read(&file) {
            Ok(bytes) => bytes,
            Err(error) => return Err(invalid(format!("{}: {}", file.display(), error.code()))),
        };
        let text = match String::from_utf8(bytes) {
            Ok(text) => text,
            Err(_) => {
                return Err(invalid(format!(
                    "{}: configuration must be UTF-8 JSON",
                    file.display()
                )));
            }
        };
        let display = file
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("mokly.config.json");
        let input = parse(&text, display)?;
        let lexical_file = file.clone();
        let file = match self.tree.project(&file) {
            Ok(Some(node)) if node.kind == FileKind::File => node.identity,
            Ok(_) => {
                return Err(invalid(format!(
                    "{} must be a regular JSON file",
                    file.display()
                )));
            }
            Err(error) => return Err(invalid(format!("{}: {}", file.display(), error.code()))),
        };
        let directory = file.parent().unwrap_or(cwd);
        let repository = normalize(&directory.join(input.repo_root.as_deref().unwrap_or(".")));
        let mut identities = BTreeMap::new();
        let repo_node = project(self.tree.as_ref(), &repository, ".", &mut identities)?;
        let Some(repo_node) = repo_node.filter(|node| node.kind == FileKind::Directory) else {
            return Err(invalid("repoRoot must name an existing directory"));
        };
        let configured = input.roots.clone().unwrap_or_else(|| {
            vec![RootConfig {
                dir: "specs".into(),
                files: None,
                path: None,
                transparent: None,
            }]
        });
        let mut projected = Vec::new();
        for root in configured {
            if traversal(&root.dir) {
                return Err(invalid(format!(
                    "roots[{}].dir: path traversal {}",
                    projected.len(),
                    root.dir
                )));
            }
            let path = normalize(&directory.join(&root.dir));
            let node = project(
                self.tree.as_ref(),
                &path,
                &relative(&path, &repo_node.identity),
                &mut identities,
            )?;
            projected.push((root, path, node));
        }
        let mut roots = Vec::new();
        for (index, (root, path, node)) in projected.into_iter().enumerate() {
            let Some(node) = node.filter(|node| node.kind == FileKind::Directory) else {
                return Err(invalid(format!(
                    "roots[{index}].dir: root is not an existing directory: {}",
                    root.dir
                )));
            };
            if !node.identity.starts_with(&repo_node.identity) || !path.starts_with(&repository) {
                return Err(invalid(format!(
                    "roots[{index}].dir: {} is outside repoRoot",
                    root.dir
                )));
            }
            roots.push(ResolvedRoot {
                input: root,
                directory: path,
                identity: node.identity,
            });
        }
        let mut config = ResolvedConfig {
            input,
            authored_inputs: Vec::new(),
            file,
            repo_root: repo_node.identity,
            roots,
        };
        config.authored_inputs = validate_inputs(self.tree.as_ref(), &config)?;
        if lexical_file.starts_with(&config.repo_root) && lexical_file != config.file {
            config.authored_inputs.push(lexical_file);
        }
        Ok(config)
    }
}

fn find(tree: &dyn SourceTree, cwd: &Path) -> Result<PathBuf> {
    let mut directory = cwd.to_owned();
    let mut searched = Vec::new();
    loop {
        searched.push(directory.display().to_string());
        let file = directory.join("mokly.config.json");
        match tree.project(&file) {
            Ok(Some(node)) if node.kind == FileKind::File => return Ok(file),
            Ok(_) => {}
            Err(error) => return Err(invalid(format!("{}: {}", file.display(), error.code()))),
        }
        if !directory.pop() {
            return Err(CatalogueError::ConfigMissing { searched });
        }
    }
}

fn project(
    tree: &dyn SourceTree,
    path: &Path,
    display: &str,
    identities: &mut BTreeMap<PathBuf, Option<Node>>,
) -> Result<Option<Node>> {
    if let Some(node) = identities.get(path) {
        return Ok(node.clone());
    }
    match tree.project(path) {
        Ok(node) => {
            identities.insert(path.into(), node.clone());
            Ok(node)
        }
        Err(error) => Err(invalid(format!("{display}: {}", error.code()))),
    }
}

pub(crate) fn traversal(path: &str) -> bool {
    path.contains('\\')
        || path.split('/').any(|part| part == "..")
        || path.chars().any(char::is_control)
}

pub(crate) fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                result.pop();
            }
            _ => result.push(component),
        }
    }
    result
}

/// Convert an internal source-tree path to repository-relative POSIX spelling.
pub fn relative(path: &Path, repository: &Path) -> String {
    path.strip_prefix(repository)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

#[cfg(test)]
#[path = "_tests_/scale_tests.rs"]
mod scale_tests;

#[cfg(test)]
#[path = "_tests_/config_projection_tests.rs"]
mod config_projection_tests;
