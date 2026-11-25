//! One root walk per pass, with explicit ownership and protected source membership.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::canonical::compare_utf16;
use mokly_source_interface::tree::SourceTree;

use crate::config::{normalize, relative};
use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::discovery_walk::Walk;
use crate::error::Result;
use crate::folder_input::FolderInput;
use crate::globs::{self, DEFAULT_GLOBS};
use crate::storybook_roots::display_folder;

/// Source file classification, independent of JavaScript evaluation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SourceKind {
    /// HTML screen fragment.
    Screen,
    /// HTML component fragment.
    Component,
    /// Complete authored page.
    Page,
    /// YAML journey definition.
    UseCase,
    /// Markdown document.
    Document,
    /// Storybook stories inventory.
    Stories,
    /// Every other root-glob match is an entry module.
    Module,
}

impl SourceKind {
    /// Classify a matched file using only its complete suffix.
    pub fn from_path(path: &str) -> Self {
        for (suffix, kind) in [
            (".screen.html", Self::Screen),
            (".component.html", Self::Component),
            (".page.html", Self::Page),
            (".use-case.yaml", Self::UseCase),
            (".md", Self::Document),
        ] {
            if path.ends_with(suffix) {
                return kind;
            }
        }
        if [".stories.ts", ".stories.tsx", ".stories.js", ".stories.jsx"]
            .iter()
            .any(|suffix| path.ends_with(suffix))
        {
            Self::Stories
        } else {
            Self::Module
        }
    }
}

/// One discovered file with exactly one root owner.
#[derive(Clone, Debug)]
pub struct SourceFile {
    /// Repository-relative lexical path.
    pub path: String,
    /// Read path in the private source tree.
    pub absolute: PathBuf,
    /// Repository-relative physical identity, protecting root aliases.
    pub identity: String,
    /// Effective root index after Storybook expansion.
    pub root_index: usize,
    /// Entry parser or sidecar classification.
    pub kind: SourceKind,
    /// Folder exclusion affects collection, but never source protection.
    pub excluded: bool,
}

/// Resolved inventory, reused by every later stage of one pass.
#[derive(Clone, Debug, Default)]
pub struct Inventory {
    /// Sorted root-glob matches, including excluded files.
    pub files: Vec<SourceFile>,
    /// Sorted private source paths and realpath aliases.
    pub sources: Vec<String>,
    pub(crate) folders: Vec<FolderInput>,
}

/// Root discovery boundary, consumed through `dyn Discovery`.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiscoveryMock))]
pub trait Discovery: Send + Sync {
    /// Walk each root once. Optional output is pruned only as a directory below a root.
    fn discover(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<Inventory>;
}

/// Source-tree backed root walker.
pub struct Discoverer {
    /// Working tree or Git-tree reader.
    pub tree: Arc<dyn SourceTree>,
}

impl Discovery for Discoverer {
    #[tracing::instrument(name = "catalogue.discover", skip_all, err)]
    fn discover(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<Inventory> {
        let output = match output {
            Some(path) => match self.tree.project(path) {
                Ok(Some(node)) => Some(node.identity),
                Ok(None) => Some(normalize(path)),
                Err(error) if error.is_vanished() => Some(normalize(path)),
                Err(error) => {
                    return Err(invalid(format!(
                        "{}: {}",
                        relative(path, &config.repo_root),
                        error.code()
                    )));
                }
            },
            None => None,
        };
        let mut inventory = Inventory {
            files: Vec::new(),
            sources: Vec::new(),
            folders: Vec::new(),
        };
        let mut owners = BTreeMap::new();
        let mut candidates = BTreeMap::new();
        let mut folder_globs = BTreeMap::new();
        let mut group_start = 0;
        let mut not_searched = Vec::new();
        for (index, root) in config.roots.iter().enumerate() {
            let configured = root.configured_index(index);
            if root.pending_storybook() {
                let folder = display_folder(root.storybook.as_str());
                return Err(invalid(format!("{folder}/main.* has not been loaded")));
            }
            let patterns = root
                .input
                .files
                .clone()
                .unwrap_or_else(|| DEFAULT_GLOBS.iter().map(|s| (*s).into()).collect());
            let globs = match globs::compile(&patterns) {
                Ok(globs) => globs,
                Err(reason) => return Err(invalid(format!("roots[{configured}].files: {reason}"))),
            };
            let mut walk = Walk {
                tree: self.tree.as_ref(),
                config,
                root,
                index,
                configured,
                globs,
                output: output.as_deref(),
                not_searched: Vec::new(),
                owners: &mut owners,
                folder_globs: &mut folder_globs,
                candidates: &mut candidates,
                inventory: &mut inventory,
            };
            walk.directory(&root.directory, &[])?;
            not_searched.extend(walk.not_searched);
            if config
                .roots
                .get(index + 1)
                .is_some_and(|next| next.configured_index(index + 1) == configured)
            {
                continue;
            }
            if !inventory.files[group_start..]
                .iter()
                .any(|file| !file.excluded)
            {
                not_searched.sort_by(|a, b| compare_utf16(a, b));
                not_searched.dedup();
                let suffix = if not_searched.is_empty() {
                    String::new()
                } else {
                    format!("; not searched: {}", not_searched.join(", "))
                };
                let directory = if root.from_storybook_main() {
                    display_folder(root.storybook.as_str())
                } else {
                    &root.input.dir
                };
                return Err(invalid(format!(
                    "root matches no file: {directory}{suffix}"
                )));
            }
            group_start = inventory.files.len();
            not_searched.clear();
        }
        inventory
            .files
            .sort_by(|a, b| compare_utf16(&a.path, &b.path));
        inventory.sources.extend(
            inventory
                .files
                .iter()
                .flat_map(|file| [file.path.clone(), file.identity.clone()]),
        );
        inventory.sources.sort_by(|a, b| compare_utf16(a, b));
        inventory.sources.dedup();
        Ok(inventory)
    }
}

#[cfg(test)]
#[path = "_tests_/discovery_tests.rs"]
mod discovery_tests;
