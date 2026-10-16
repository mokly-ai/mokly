//! Native directory observation extends exact inputs without replacing root observers.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use mokly_source_interface::tree::{FileKind, SourceTree};

use crate::backend::{DirectoryWatch, NotifyFactory, WatchFactory};
use crate::error::Result;
use crate::event::{Event, Kind};
use crate::native_events::Receiver;
use crate::native_scan;
use crate::observer::{Inbox, Observer};
use crate::plan::Plan;

/// Composition root for the platform observer and injected source reader.
pub struct NativeObserver {
    closed: AtomicBool,
    tree: Arc<dyn SourceTree>,
    factory: Arc<dyn WatchFactory>,
    inbox: Arc<Inbox>,
    state: Mutex<Option<State>>,
}

struct State {
    watcher: Box<dyn DirectoryWatch>,
    roots: BTreeSet<PathBuf>,
    root_directories: BTreeSet<PathBuf>,
    parents: BTreeMap<PathBuf, BTreeSet<PathBuf>>,
    directories: BTreeSet<PathBuf>,
    replaced: BTreeSet<PathBuf>,
}

impl NativeObserver {
    /// Attach synchronously before consumer JavaScript evaluates.
    pub fn new(tree: Arc<dyn SourceTree>, plan: &Plan) -> Result<Self> {
        Self::with_factory(tree.clone(), plan, Arc::new(NotifyFactory { tree }))
    }

    /// Inject native registrations for captured-target and event-order tests.
    pub fn with_factory(
        tree: Arc<dyn SourceTree>,
        plan: &Plan,
        factory: Arc<dyn WatchFactory>,
    ) -> Result<Self> {
        let observer = Self {
            closed: AtomicBool::new(false),
            tree,
            factory,
            inbox: Arc::new(Inbox::default()),
            state: Mutex::new(None),
        };
        observer.rescan(plan)?;
        Ok(observer)
    }

    fn update(&self, plan: &Plan, scan: bool) -> Result<()> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.closed.load(Ordering::SeqCst) {
            return Ok(());
        }
        let targets = plan.targets();
        let replace = state.as_ref().is_none_or(|state| state.roots != plan.roots);
        if replace {
            let root_directories = native_scan::directories(self.tree.as_ref(), plan)?;
            let parents: BTreeMap<_, _> = targets
                .iter()
                .map(|path| {
                    (
                        path.clone(),
                        native_scan::parents(self.tree.as_ref(), path, &plan.repository),
                    )
                })
                .collect();
            let mut directories = root_directories.clone();
            directories.extend(parents.values().flatten().cloned());
            let mut watcher = self.factory.create(Arc::new(Receiver {
                repository: plan.repository.clone(),
                inbox: self.inbox.clone(),
                warned: AtomicBool::new(false),
            }))?;
            let directories = watcher.update(&directories, &BTreeSet::new())?;
            *state = Some(State {
                watcher,
                roots: plan.roots.clone(),
                root_directories,
                parents,
                directories,
                replaced: BTreeSet::new(),
            });
        } else if let Some(state) = state.as_mut() {
            if scan {
                state.root_directories = native_scan::directories(self.tree.as_ref(), plan)?;
            }
            state.parents.retain(|path, _| targets.contains(path));
            for path in targets {
                if scan || !state.parents.contains_key(&path) {
                    let parents = native_scan::parents(self.tree.as_ref(), &path, &plan.repository);
                    state.parents.insert(path, parents);
                }
            }
            let mut directories = state.root_directories.clone();
            directories.extend(state.parents.values().flatten().cloned());
            let mut add: BTreeSet<_> = directories
                .difference(&state.directories)
                .cloned()
                .collect();
            let mut remove: BTreeSet<_> = state
                .directories
                .difference(&directories)
                .cloned()
                .collect();
            if cfg!(any(
                target_os = "linux",
                target_os = "android",
                target_os = "windows"
            )) {
                add.extend(state.replaced.intersection(&directories).cloned());
                remove.extend(state.replaced.iter().cloned());
            }
            if !add.is_empty() || !remove.is_empty() {
                let attached = state.watcher.update(&add, &remove)?;
                directories.retain(|path| !add.contains(path) || attached.contains(path));
            }
            state.directories = directories;
            state.replaced.clear();
        }
        Ok(())
    }
}

#[async_trait]
impl Observer for NativeObserver {
    fn replace(&self, plan: &Plan) -> Result<()> {
        self.update(plan, false)
    }
    fn rescan(&self, plan: &Plan) -> Result<()> {
        self.update(plan, true)
    }
    async fn changed(&self) {
        self.inbox.changed().await;
    }
    fn take(&self) -> Vec<Result<Event>> {
        let mut events = Vec::new();
        for result in self.inbox.take() {
            let mut event = match result {
                Ok(event) => event,
                Err(error) => {
                    events.push(Err(error));
                    continue;
                }
            };
            if event.kind == Kind::Modify {
                if matches!(self.tree.project(&event.path), Ok(Some(node)) if node.kind == FileKind::Directory)
                {
                    continue;
                }
                event.kind = Kind::File;
            }
            if matches!(event.kind, Kind::Rename | Kind::Directory) {
                let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
                if let Some(state) = state.as_mut() {
                    state.replaced.extend(
                        state
                            .directories
                            .iter()
                            .filter(|path| path.starts_with(&event.path))
                            .cloned(),
                    );
                }
            }
            if event.kind == Kind::Rename {
                event.kind = match self.tree.project(&event.path) {
                    Ok(Some(node)) if node.kind == FileKind::Directory => Kind::Directory,
                    _ => Kind::Membership,
                };
            }
            events.push(Ok(event));
        }
        events
    }

    fn replay(&self, events: Vec<Result<Event>>) {
        for event in events {
            self.inbox.send(event);
        }
    }
    fn close(&self) {
        self.closed.store(true, Ordering::SeqCst);
        *self.state.lock().unwrap_or_else(|error| error.into_inner()) = None;
        self.inbox.take();
    }
}

#[cfg(test)]
#[path = "_tests_/native_registration_tests.rs"]
mod native_registration_tests;

#[cfg(test)]
#[path = "_tests_/native_recovery_tests.rs"]
mod native_recovery_tests;
