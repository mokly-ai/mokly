//! Required paths take precedence over broad root traversal and user rules.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::Duration;

use globset::GlobSet;
use mokly_catalogue::config_types::WatchAction;
use mokly_catalogue::discovery::SourceKind;

use crate::event::{Action, Event, Kind};
use crate::pattern;
use crate::stylesheet_inputs;

mod setup;

/// Resolved watch inputs and precomputed ancestor lookup for one catalogue state.
#[derive(Clone)]
pub struct Plan {
    /// Repository identity used by rules and diagnostics.
    pub repository: PathBuf,
    /// Debounce interval from validated configuration.
    pub debounce: Duration,
    /// Exact required inputs and their package-owned actions.
    pub exact: HashMap<PathBuf, Action>,
    /// Required ancestors and the strongest action of their descendants.
    pub ancestors: HashMap<PathBuf, Action>,
    /// Effective recursive roots, including empty PostCSS directories.
    pub roots: BTreeSet<PathBuf>,
    pub(crate) dependency_roots: BTreeMap<PathBuf, PathBuf>,
    resolution_directories: BTreeMap<PathBuf, BTreeSet<String>>,
    root_index: HashSet<PathBuf>,
    waypoints: HashSet<PathBuf>,
    source_roots: Vec<(PathBuf, GlobSet, bool)>,
    directories: Vec<(PathBuf, GlobSet)>,
    rules: Vec<(WatchAction, GlobSet)>,
    output: PathBuf,
}

impl Plan {
    /// Resolution metadata and direct file membership extend exact observation only.
    pub fn resolution(
        &mut self,
        files: &BTreeSet<String>,
        directories: &BTreeMap<String, BTreeSet<String>>,
    ) {
        for file in files {
            self.required(self.repository.join(file), Action::Rebuild);
        }
        for (directory, names) in directories {
            self.resolution_directories
                .insert(self.repository.join(directory), names.clone());
        }
    }

    /// Exact stylesheet candidates retain only their own admitting dependency folder.
    pub fn stylesheet_resolution(
        &mut self,
        files: &BTreeSet<String>,
        roots: &BTreeMap<String, PathBuf>,
        cache: Option<&Path>,
        namespace: Option<&Path>,
    ) {
        for (path, root) in
            stylesheet_inputs::admitted(&self.repository, files, roots, cache, namespace)
        {
            self.required(path.clone(), Action::Rebuild);
            if let Some(root) = root {
                self.dependency_roots.insert(path, root);
            }
        }
    }

    /// Newly rendered closures become observable before the background pass completes.
    pub fn resources(&mut self, paths: &BTreeSet<String>) {
        for path in paths {
            self.required(self.repository.join(path), Action::Reload);
        }
    }

    /// Keep the active generation's required paths attached until candidate adoption.
    pub fn extend_required(&mut self, previous: &Self) {
        for (path, action) in &previous.exact {
            self.required(path.clone(), *action);
        }
        for (path, root) in &previous.dependency_roots {
            self.dependency_roots
                .entry(path.clone())
                .or_insert_with(|| root.clone());
        }
    }

    fn required(&mut self, path: PathBuf, action: Action) {
        for ancestor in path.ancestors().skip(1) {
            self.ancestors
                .entry(ancestor.to_owned())
                .and_modify(|old| *old = (*old).max(action))
                .or_insert(action);
        }
        self.exact
            .entry(path)
            .and_modify(|old| *old = (*old).max(action))
            .or_insert(action);
    }

    /// Ignore broad traversal only. Exact files and root waypoints always survive.
    pub fn denied(&self, path: &Path, directory: bool) -> bool {
        if self.exact.contains_key(path)
            || self.ancestors.contains_key(path)
            || self.waypoints.contains(path)
        {
            return false;
        }
        if path.starts_with(&self.output)
            || path.starts_with(self.repository.join(".mokly-export-reservations"))
        {
            return true;
        }
        let root = path
            .ancestors()
            .find(|ancestor| self.root_index.contains(*ancestor))
            .unwrap_or(&self.repository);
        let Ok(suffix) = path.strip_prefix(root) else {
            return true;
        };
        let parts: Vec<_> = suffix.iter().collect();
        parts.iter().enumerate().any(|(index, part)| {
            (directory || index + 1 < parts.len()) && pattern::denied(&part.to_string_lossy())
        })
    }

    /// Classify a descriptor after the native adapter resolves raw renames.
    pub fn classify(&self, event: &Event) -> Option<Action> {
        if let Some(action) = self.exact.get(&event.path) {
            return Some(*action);
        }
        if let Some(action) = self.ancestors.get(&event.path) {
            return Some(*action);
        }
        if let Some(names) = event
            .path
            .parent()
            .and_then(|path| self.resolution_directories.get(path))
            && (event.kind == Kind::Membership
                || (event.kind == Kind::File
                    && event
                        .path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .is_none_or(|name| !names.contains(name))))
        {
            return Some(Action::Rebuild);
        }
        if self.denied(&event.path, event.kind == Kind::Directory) {
            return None;
        }
        for (root, globs, stories_only) in &self.source_roots {
            if let Ok(suffix) = event.path.strip_prefix(root)
                && (event.kind == Kind::Directory
                    || suffix
                        .file_name()
                        .is_some_and(|name| name == "_folder.json")
                    || ((!stories_only
                        || SourceKind::from_path(&suffix.to_string_lossy())
                            == SourceKind::Stories)
                        && globs.is_match(suffix)))
            {
                return Some(Action::Rebuild);
            }
        }
        for (root, globs) in &self.directories {
            if let Ok(suffix) = event.path.strip_prefix(root)
                && (event.kind == Kind::Directory || globs.is_match(suffix))
            {
                return Some(Action::Rebuild);
            }
        }
        let suffix = event.path.strip_prefix(&self.repository).ok()?;
        for (action, globs) in &self.rules {
            if globs.is_match(suffix) {
                return match action {
                    WatchAction::Ignore => None,
                    WatchAction::Rebuild => Some(Action::Rebuild),
                    WatchAction::Reload => Some(Action::Reload),
                };
            }
        }
        None
    }

    /// Required files covered by accepted directories need no separate recursive target.
    pub fn targets(&self) -> BTreeSet<PathBuf> {
        let mut targets = self.roots.clone();
        targets.extend(self.resolution_directories.keys().cloned());
        for path in self.exact.keys() {
            let covered = self.roots.iter().any(|root| {
                path.starts_with(root)
                    && !path
                        .strip_prefix(root)
                        .unwrap_or(path)
                        .iter()
                        .rev()
                        .skip(1)
                        .any(|part| pattern::denied(&part.to_string_lossy()))
            });
            if !covered {
                targets.insert(path.clone());
            }
        }
        targets
    }
}
