//! Root-local traversal and candidate validation over the source-tree trait.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use globset::GlobSet;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::SourceLocation;
use mokly_source_interface::tree::{FileKind, Node, SourceTree};

use crate::config::relative;
use crate::config_types::{ResolvedConfig, ResolvedRoot};
use crate::config_validation::invalid;
use crate::diagnostic::{Code, Issue};
use crate::discovery::{Inventory, SourceFile, SourceKind};
use crate::error::{CatalogueError, Result};
use crate::folder_input;
use crate::globs::{self, denied_directory};
use crate::identity::{folder_path, segment};
use crate::locations::at;

pub(crate) struct Walk<'a> {
    pub(crate) tree: &'a dyn SourceTree,
    pub(crate) config: &'a ResolvedConfig,
    pub(crate) root: &'a ResolvedRoot,
    pub(crate) index: usize,
    pub(crate) globs: GlobSet,
    pub(crate) output: Option<&'a Path>,
    pub(crate) not_searched: Vec<String>,
    pub(crate) candidates: &'a mut BTreeMap<PathBuf, Option<Node>>,
    pub(crate) owners: &'a mut BTreeMap<PathBuf, (String, usize)>,
    pub(crate) inventory: &'a mut Inventory,
}

impl Walk<'_> {
    pub(crate) fn directory(
        &mut self,
        directory: &Path,
        inherited: &[(PathBuf, GlobSet)],
    ) -> Result<()> {
        enum Work {
            Directory(PathBuf),
            Child(PathBuf, FileKind),
            Leave(usize),
        }
        let mut exclusions = inherited.to_vec();
        let mut pending = vec![Work::Directory(directory.into())];
        while let Some(work) = pending.pop() {
            match work {
                Work::Leave(length) => exclusions.truncate(length),
                Work::Child(path, FileKind::Directory) => {
                    let name = path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("");
                    if denied_directory(name) || self.output == Some(path.as_path()) {
                        self.not_searched
                            .push(relative(&path, &self.config.repo_root));
                    } else {
                        pending.push(Work::Directory(path));
                    }
                }
                Work::Child(path, FileKind::File) => {
                    if path.file_name().is_none_or(|name| name != "_folder.json")
                        && self
                            .globs
                            .is_match(path.strip_prefix(&self.root.directory).unwrap_or(&path))
                    {
                        self.file(&path, &exclusions)?;
                    }
                }
                Work::Child(_, _) => {}
                Work::Directory(directory) => {
                    let suffix = directory
                        .strip_prefix(&self.root.directory)
                        .unwrap_or(&directory);
                    let scan_path = self.root.identity.join(suffix);
                    let mut children = match self.tree.children(&scan_path) {
                        Ok(children) => children,
                        Err(error) if error.is_vanished() => {
                            self.not_searched
                                .push(relative(&directory, &self.config.repo_root));
                            continue;
                        }
                        Err(error) => {
                            return Err(invalid(format!(
                                "{}: {}",
                                relative(&directory, &self.config.repo_root),
                                error.code()
                            )));
                        }
                    };
                    children.sort_by(|a, b| compare_utf16(&a.name, &b.name));
                    let length = exclusions.len();
                    if children
                        .iter()
                        .any(|child| child.name == "_folder.json" && child.kind == FileKind::File)
                    {
                        self.folder(&directory, &mut exclusions)?;
                    }
                    pending.push(Work::Leave(length));
                    pending.extend(
                        children
                            .into_iter()
                            .rev()
                            .map(|child| Work::Child(directory.join(child.name), child.kind)),
                    );
                }
            }
        }
        Ok(())
    }

    fn project_file(&mut self, path: &Path) -> Result<Option<PathBuf>> {
        let node = if let Some(node) = self.candidates.get(path) {
            node.clone()
        } else {
            let node = match self.tree.project(path) {
                Ok(node) => node,
                Err(error) if error.is_vanished() => None,
                Err(error) => {
                    return Err(invalid(format!(
                        "{}: {}",
                        relative(path, &self.config.repo_root),
                        error.code()
                    )));
                }
            };
            self.candidates.insert(path.into(), node.clone());
            node
        };
        let Some(node) =
            node.filter(|node| node.kind == FileKind::File && node.lexical_kind == FileKind::File)
        else {
            self.not_searched
                .push(relative(path, &self.config.repo_root));
            return Ok(None);
        };
        if !node.identity.starts_with(&self.config.repo_root) {
            return Err(invalid(format!(
                "file {} resolves outside repoRoot; matched roots[{}].files",
                relative(path, &self.config.repo_root),
                self.index
            )));
        }
        if let Some((first, owner)) = self.owners.get(&node.identity) {
            return Err(invalid(format!(
                "file {first} is matched by roots[{owner}] and roots[{}]",
                self.index
            )));
        }
        self.owners.insert(
            node.identity.clone(),
            (relative(path, &self.config.repo_root), self.index),
        );
        Ok(Some(node.identity))
    }
    fn file(&mut self, path: &Path, exclusions: &[(PathBuf, GlobSet)]) -> Result<()> {
        let Some(identity) = self.project_file(path)? else {
            return Ok(());
        };
        let relative_path = relative(path, &self.config.repo_root);
        self.inventory.files.push(SourceFile {
            path: relative_path.clone(),
            absolute: path.into(),
            identity: relative(&identity, &self.config.repo_root),
            root_index: self.index,
            kind: SourceKind::from_path(&relative_path),
            excluded: exclusions.iter().any(|(directory, globs)| {
                globs.is_match(path.strip_prefix(directory).unwrap_or(path))
            }),
        });
        Ok(())
    }
    fn folder(&mut self, directory: &Path, exclusions: &mut Vec<(PathBuf, GlobSet)>) -> Result<()> {
        let file = directory.join("_folder.json");
        let Some(identity) = self.project_file(&file)? else {
            return Ok(());
        };
        let path = relative(&file, &self.config.repo_root);
        let bytes = match self.tree.read(&file) {
            Ok(bytes) => bytes,
            Err(error) if error.is_vanished() => return Ok(()),
            Err(error) => return Err(invalid(format!("{path}: {}", error.code()))),
        };
        let text = match String::from_utf8(bytes) {
            Ok(text) => text,
            Err(error) => {
                let (message, line, column) =
                    match serde_json::from_slice::<serde_json::Value>(error.as_bytes()) {
                        Err(source) => (source.to_string(), source.line(), source.column()),
                        Ok(_) => ("folder record must be UTF-8 JSON".into(), 1, 1),
                    };
                return Err(folder_error(
                    Issue::new(
                        Code::InvalidFolder,
                        format!("{path}: invalid JSON: {message}"),
                    )
                    .at(SourceLocation {
                        path,
                        line,
                        column,
                        export: None,
                    }),
                ));
            }
        };
        let folder_path = folder_path(self.root, directory);
        let source = at(&path, &text, 0);
        for name in folder_path.split('/').filter(|segment| !segment.is_empty()) {
            if let Err(issue) = segment(name, "directory name", &source) {
                return Err(folder_error(issue));
            }
        }
        let parsed = match folder_input::parse(&text, &path, folder_path) {
            Ok(parsed) => parsed,
            Err(issue) => return Err(folder_error(issue)),
        };
        let globs = match globs::compile(&parsed.exclude) {
            Ok(globs) => globs,
            Err(reason) => return Err(invalid(reason)),
        };
        exclusions.push((directory.into(), globs));
        self.inventory
            .sources
            .extend([path, relative(&identity, &self.config.repo_root)]);
        self.inventory.folders.push(parsed);
        Ok(())
    }
}

fn folder_error(issue: Issue) -> CatalogueError {
    CatalogueError::Invalid {
        issues: vec![issue],
        warnings: Vec::new(),
    }
}
