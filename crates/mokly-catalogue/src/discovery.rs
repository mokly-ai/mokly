//! One root walk per pass, with explicit ownership and protected source membership.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_model::canonical::compare_utf16;
use mokly_source_interface::tree::SourceTree;

use crate::config_types::ResolvedConfig;
use crate::config_validation::invalid;
use crate::discovery_walk::Walk;
use crate::error::Result;
use crate::folder_input::FolderInput;
use crate::globs::{self, DEFAULT_GLOBS};

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
    /// Root index in configured order.
    pub root_index: usize,
    /// Entry parser or sidecar classification.
    pub kind: SourceKind,
    /// Folder exclusion affects collection, but never source protection.
    pub excluded: bool,
}

/// Resolved inventory, reused by every later stage of one pass.
#[derive(Clone, Debug)]
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
    fn discover(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<Inventory> {
        let mut inventory = Inventory {
            files: Vec::new(),
            sources: Vec::new(),
            folders: Vec::new(),
        };
        let mut owners = BTreeMap::new();
        let mut candidates = BTreeMap::new();
        for (index, root) in config.roots.iter().enumerate() {
            let patterns = root
                .input
                .files
                .clone()
                .unwrap_or_else(|| DEFAULT_GLOBS.iter().map(|s| (*s).into()).collect());
            let globs = match globs::compile(&patterns) {
                Ok(globs) => globs,
                Err(reason) => return Err(invalid(format!("roots[{index}].files: {reason}"))),
            };
            let mut walk = Walk {
                tree: self.tree.as_ref(),
                config,
                root,
                index,
                globs,
                output,
                not_searched: Vec::new(),
                owners: &mut owners,
                candidates: &mut candidates,
                inventory: &mut inventory,
            };
            let before = walk.inventory.files.len();
            walk.directory(&root.directory, &[])?;
            if !walk.inventory.files[before..]
                .iter()
                .any(|file| !file.excluded)
            {
                walk.not_searched.sort_by(|a, b| compare_utf16(a, b));
                walk.not_searched.dedup();
                let suffix = if walk.not_searched.is_empty() {
                    String::new()
                } else {
                    format!("; not searched: {}", walk.not_searched.join(", "))
                };
                return Err(invalid(format!(
                    "root matches no file: {}{suffix}",
                    root.input.dir
                )));
            }
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
