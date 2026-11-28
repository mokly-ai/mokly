//! Collect directory records and place them after each configured root's walks.

use std::collections::BTreeMap;
use std::ops::RangeInclusive;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use globset::GlobSet;
use mokly_model::catalogue::SourceLocation;

use crate::config::relative;
use crate::config_types::ResolvedRoot;
use crate::config_validation::invalid;
use crate::diagnostic::{Code, Issue};
use crate::discovery::{SourceFile, SourceKind};
use crate::discovery_walk::Walk;
use crate::error::{CatalogueError, Result};
use crate::folder_input::{self, FolderInput};
use crate::globs::{self, GlobSyntax};
use crate::identity::{folder_path, segment};

#[derive(Default)]
pub(crate) struct FolderRecords {
    identities: BTreeMap<PathBuf, Arc<GlobSet>>,
    directories: BTreeMap<PathBuf, Arc<GlobSet>>,
    pending: Vec<PendingFolder>,
}

struct PendingFolder {
    directory: PathBuf,
    first_entry: usize,
    parsed: FolderInput,
}

impl FolderRecords {
    pub(crate) fn finish(
        self,
        roots: &[ResolvedRoot],
        entries: RangeInclusive<usize>,
        files: &mut [SourceFile],
        records: &mut Vec<FolderInput>,
    ) -> Result<()> {
        let mut story_owners = BTreeMap::<&Path, &ResolvedRoot>::new();
        for file in files {
            file.excluded = self.excludes(&file.absolute);
            let owner = &roots[file.root_index];
            if file.excluded || file.kind != SourceKind::Stories || !owner.from_storybook_main() {
                continue;
            }
            for directory in file.absolute.ancestors().skip(1) {
                if self.directories.contains_key(directory) {
                    let deepest = story_owners.entry(directory).or_insert(owner);
                    if owner.directory.starts_with(&deepest.directory) {
                        *deepest = owner;
                    }
                }
                if directory == owner.directory {
                    break;
                }
            }
        }
        let entry_directories: BTreeMap<_, _> = roots[entries]
            .iter()
            .map(|root| (root.directory.as_path(), root))
            .collect();
        for pending in self.pending {
            let directory = pending.directory.as_path();
            let root = story_owners
                .get(directory)
                .copied()
                .or_else(|| {
                    directory
                        .ancestors()
                        .find_map(|parent| entry_directories.get(parent).copied())
                })
                .unwrap_or(&roots[pending.first_entry]);
            let path = folder_path(root, directory);
            let source = SourceLocation {
                path: pending.parsed.record.source.path.clone(),
                line: 1,
                column: 1,
                export: None,
            };
            for name in path.split('/').filter(|name| !name.is_empty()) {
                if let Err(issue) = segment(name, "directory name", &source) {
                    return Err(folder_error(issue));
                }
            }
            match pending.parsed.at_path(path) {
                Ok(record) => records.push(record),
                Err(issue) => return Err(folder_error(issue)),
            }
        }
        Ok(())
    }

    fn excludes(&self, path: &Path) -> bool {
        path.ancestors().skip(1).any(|directory| {
            self.directories
                .get(directory)
                .is_some_and(|globs| globs.is_match(path.strip_prefix(directory).unwrap_or(path)))
        })
    }
}

impl Walk<'_> {
    pub(crate) fn folder(&mut self, directory: &Path) -> Result<()> {
        let file = directory.join("_folder.json");
        let Some((identity, first)) = self.project_file(&file)? else {
            return Ok(());
        };
        if !first {
            if let Some(globs) = self.folders.identities.get(&identity) {
                self.folders
                    .directories
                    .insert(directory.into(), globs.clone());
            }
            return Ok(());
        }
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
        let parsed = match folder_input::parse(&text, &path) {
            Ok(parsed) => parsed,
            Err(issue) => return Err(folder_error(issue)),
        };
        let globs = match globs::compile(&parsed.exclude, GlobSyntax::Posix) {
            Ok(globs) => Arc::new(globs),
            Err(reason) => return Err(invalid(reason.to_string())),
        };
        if self.root.from_storybook_main() {
            self.folders
                .identities
                .insert(identity.clone(), globs.clone());
        }
        self.folders.directories.insert(directory.into(), globs);
        self.inventory
            .sources
            .extend([path, relative(&identity, &self.config.repo_root)]);
        self.folders.pending.push(PendingFolder {
            directory: directory.into(),
            first_entry: self.index,
            parsed,
        });
        Ok(())
    }
}

fn folder_error(issue: Issue) -> CatalogueError {
    CatalogueError::Invalid {
        issues: vec![issue],
        warnings: Vec::new(),
    }
}
