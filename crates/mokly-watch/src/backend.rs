//! Batched native registrations behind an injectable boundary.

use std::collections::BTreeSet;
use std::io;
use std::path::PathBuf;
use std::sync::Arc;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};

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
pub struct NotifyFactory;
struct NotifyWatch {
    watcher: RecommendedWatcher,
    attached: BTreeSet<PathBuf>,
}

impl WatchFactory for NotifyFactory {
    fn create(&self, events: Arc<dyn NativeEvents>) -> Result<Box<dyn DirectoryWatch>> {
        match notify::recommended_watcher(move |event| events.send(event)) {
            Ok(watcher) => Ok(Box::new(NotifyWatch {
                watcher,
                attached: BTreeSet::new(),
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
        let mut paths = self.watcher.paths_mut();
        let mut error = None;
        for path in remove {
            if !self.attached.contains(path) {
                continue;
            }
            match paths.remove(path) {
                Ok(()) => {
                    self.attached.remove(path);
                }
                Err(source)
                    if matches!(
                        source.kind,
                        notify::ErrorKind::WatchNotFound | notify::ErrorKind::PathNotFound
                    ) =>
                {
                    self.attached.remove(path);
                }
                Err(source) => {
                    error.get_or_insert(Error::Observer { source });
                }
            }
        }
        let mut attached = BTreeSet::new();
        for path in add {
            if self.attached.contains(path) {
                attached.insert(path.clone());
                continue;
            }
            match paths.add(path, RecursiveMode::NonRecursive) {
                Ok(()) => {
                    self.attached.insert(path.clone());
                    attached.insert(path.clone());
                }
                Err(source) if vanished(&source) => {}
                Err(source) => {
                    error.get_or_insert(Error::Observer { source });
                }
            }
        }
        if let Err(source) = paths.commit() {
            error.get_or_insert(Error::Observer { source });
        }
        match error {
            Some(error) => Err(error),
            None => Ok(attached),
        }
    }
}

fn vanished(error: &notify::Error) -> bool {
    matches!(&error.kind, notify::ErrorKind::PathNotFound)
        || matches!(&error.kind, notify::ErrorKind::Io(source) if matches!(source.kind(), io::ErrorKind::NotFound | io::ErrorKind::NotADirectory))
}

#[cfg(test)]
#[path = "_tests_/backend_tests.rs"]
mod backend_tests;
