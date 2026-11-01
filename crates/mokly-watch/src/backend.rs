//! Batched native registrations behind an injectable boundary.

use std::collections::BTreeSet;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_source_interface::tree::{FileKind, SourceTree};
use notify::{PathOp, RecommendedWatcher, UpdatePathsError, Watcher};

use crate::error::{Error, Result};

/// Receives platform events without filesystem access on the native callback.
pub trait NativeEvents: Send + Sync {
    /// Record a notification or observer failure.
    fn send(&self, event: notify::Result<notify::Event>);
}

/// One native handle, updated once per directory batch.
#[cfg_attr(test, unimock::unimock(api = DirectoryWatchMock))]
pub trait DirectoryWatch: Send {
    /// Apply removals and additions; return the additions that still exist.
    fn update(
        &mut self,
        add: &BTreeSet<PathBuf>,
        remove: &BTreeSet<PathBuf>,
    ) -> Result<BTreeSet<PathBuf>>;
}

/// Native handle construction belongs to the composition root.
#[cfg_attr(test, unimock::unimock(api = WatchFactoryMock))]
pub trait WatchFactory: Send + Sync {
    /// Create one handle with a durable notification sink.
    fn create(&self, events: Arc<dyn NativeEvents>) -> Result<Box<dyn DirectoryWatch>>;
}

/// Platform notify adapter.
pub struct NotifyFactory {
    /// Source projection checks directory disappearance after a platform error.
    pub tree: Arc<dyn SourceTree>,
}
struct NotifyWatch {
    watcher: Box<dyn PathUpdates>,
    attached: BTreeSet<PathBuf>,
    tree: Arc<dyn SourceTree>,
}

#[cfg_attr(test, unimock::unimock(api = PathUpdatesMock))]
trait PathUpdates: Send {
    fn apply(&mut self, operations: Vec<PathOp>) -> std::result::Result<(), Box<UpdatePathsError>>;
}

impl PathUpdates for RecommendedWatcher {
    fn apply(&mut self, operations: Vec<PathOp>) -> std::result::Result<(), Box<UpdatePathsError>> {
        Ok(self.update_paths(operations)?)
    }
}

impl WatchFactory for NotifyFactory {
    fn create(&self, events: Arc<dyn NativeEvents>) -> Result<Box<dyn DirectoryWatch>> {
        match notify::recommended_watcher(move |event| events.send(event)) {
            Ok(watcher) => Ok(Box::new(NotifyWatch {
                watcher: Box::new(watcher),
                attached: BTreeSet::new(),
                tree: self.tree.clone(),
            })),
            Err(source) => Err(Error::Observer { source }),
        }
    }
}

impl DirectoryWatch for NotifyWatch {
    fn update(
        &mut self,
        add: &BTreeSet<PathBuf>,
        remove: &BTreeSet<PathBuf>,
    ) -> Result<BTreeSet<PathBuf>> {
        let mut operations = Vec::new();
        for path in remove {
            if self.attached.contains(path) {
                operations.push(Operation::Remove(path.clone()));
            }
        }
        let mut attached = BTreeSet::new();
        for path in add {
            if self.attached.contains(path) && !remove.contains(path) {
                attached.insert(path.clone());
            } else {
                operations.push(Operation::Add(path.clone()));
            }
        }
        let mut error = None;
        while !operations.is_empty() {
            let batch = operations.iter().map(Operation::path_op).collect();
            match self.watcher.apply(batch) {
                Ok(()) => {
                    for operation in operations.drain(..) {
                        self.applied(operation, &mut attached);
                    }
                }
                Err(update) => {
                    let update = *update;
                    let Some(origin) = update.origin else {
                        error.get_or_insert(Error::Observer {
                            source: update.source,
                        });
                        operations.clear();
                        continue;
                    };
                    let applied = operations.len().saturating_sub(update.remaining.len() + 1);
                    for operation in operations.drain(..applied) {
                        self.applied(operation, &mut attached);
                    }
                    self.failed(Operation::from_path_op(origin), update.source, &mut error);
                    operations = update
                        .remaining
                        .into_iter()
                        .map(Operation::from_path_op)
                        .collect();
                }
            }
        }
        match error {
            Some(error) => Err(error),
            None => Ok(attached),
        }
    }
}

enum Operation {
    Add(PathBuf),
    Remove(PathBuf),
}

impl Operation {
    fn path_op(&self) -> PathOp {
        match self {
            Self::Add(path) => PathOp::watch_non_recursive(path.clone()),
            Self::Remove(path) => PathOp::unwatch(path.clone()),
        }
    }

    fn from_path_op(operation: PathOp) -> Self {
        match operation {
            PathOp::Watch(path, _) => Self::Add(path),
            PathOp::Unwatch(path) => Self::Remove(path),
        }
    }
}

impl NotifyWatch {
    fn applied(&mut self, operation: Operation, attached: &mut BTreeSet<PathBuf>) {
        match operation {
            Operation::Add(path) => {
                self.attached.insert(path.clone());
                attached.insert(path);
            }
            Operation::Remove(path) => {
                self.attached.remove(&path);
            }
        }
    }

    fn failed(&mut self, operation: Operation, source: notify::Error, error: &mut Option<Error>) {
        match operation {
            Operation::Remove(path)
                if matches!(
                    source.kind,
                    notify::ErrorKind::WatchNotFound | notify::ErrorKind::PathNotFound
                ) =>
            {
                self.attached.remove(&path);
            }
            Operation::Add(path) if vanished(&source, self.tree.as_ref(), &path) => {}
            _ => {
                error.get_or_insert(Error::Observer { source });
            }
        }
    }
}

fn vanished(error: &notify::Error, tree: &dyn SourceTree, path: &Path) -> bool {
    matches!(&error.kind, notify::ErrorKind::PathNotFound)
        || matches!(&error.kind, notify::ErrorKind::Io(source) if matches!(source.kind(), io::ErrorKind::NotFound | io::ErrorKind::NotADirectory))
        || matches!(tree.project(path), Ok(node) if node.as_ref().is_none_or(|node| node.kind != FileKind::Directory))
}

#[cfg(test)]
#[path = "_tests_/backend_tests.rs"]
mod backend_tests;

#[cfg(test)]
#[path = "_tests_/backend_update_tests.rs"]
mod backend_update_tests;
