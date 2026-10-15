//! Native directory observation prunes denied trees and survives atomic file saves.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use mokly_source_interface::tree::{FileKind, SourceTree};
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::error::{Error, InternalError, Result};
use crate::event::{Event, Kind};
use crate::observer::{Inbox, Observer};
use crate::plan::Plan;

/// Composition-root factory over the platform observer and injected source reader.
pub struct NativeObserver {
    closed: AtomicBool,
    tree: Arc<dyn SourceTree>,
    inbox: Arc<Inbox>,
    state: Mutex<Option<State>>,
}

struct State {
    watcher: RecommendedWatcher,
    targets: BTreeSet<PathBuf>,
    directories: BTreeSet<PathBuf>,
}

impl NativeObserver {
    /// Attach synchronously before any consumer JavaScript evaluates.
    pub fn new(tree: Arc<dyn SourceTree>, plan: &Plan) -> Result<Self> {
        let observer = Self {
            closed: AtomicBool::new(false),
            tree,
            inbox: Arc::new(Inbox::default()),
            state: Mutex::new(None),
        };
        observer.replace(plan)?;
        Ok(observer)
    }

    fn watcher(&self) -> Result<RecommendedWatcher> {
        let inbox = self.inbox.clone();
        match notify::recommended_watcher(move |result: notify::Result<notify::Event>| match result
        {
            Ok(event) => {
                let kind = match event.kind {
                    EventKind::Access(_) => return,
                    EventKind::Create(CreateKind::Folder)
                    | EventKind::Remove(RemoveKind::Folder) => Kind::Directory,
                    EventKind::Modify(ModifyKind::Name(_)) | EventKind::Any | EventKind::Other => {
                        Kind::Rename
                    }
                    _ => Kind::File,
                };
                for path in event.paths {
                    inbox.send(Ok(Event { path, kind }));
                }
            }
            Err(source) => inbox.send(Err(Error::Observer {
                path: PathBuf::new(),
                source,
            })),
        }) {
            Ok(watcher) => Ok(watcher),
            Err(source) => Err(Error::Observer {
                path: PathBuf::new(),
                source,
            }),
        }
    }

    fn directories(&self, plan: &Plan) -> Result<BTreeSet<PathBuf>> {
        let mut result = BTreeSet::new();
        let mut visited = BTreeSet::new();
        let mut pending: Vec<_> = plan.roots.iter().cloned().collect();
        for path in plan.targets() {
            result.extend(existing_parents(
                self.tree.as_ref(),
                &path,
                &plan.repository,
            ));
        }
        while let Some(directory) = pending.pop() {
            if plan.denied(&directory, true) || !visited.insert(directory.clone()) {
                continue;
            }
            result.insert(directory.clone());
            let children = match self.tree.children(&directory) {
                Ok(children) => children,
                Err(source) if source.is_vanished() => {
                    result.remove(&directory);
                    continue;
                }
                Err(source) => return Err(InternalError::Source { source }.into()),
            };
            for child in children {
                if child.kind == FileKind::Directory {
                    pending.push(directory.join(child.name));
                }
            }
        }
        Ok(result)
    }
}

#[async_trait]
impl Observer for NativeObserver {
    fn replace(&self, plan: &Plan) -> Result<()> {
        if self.closed.load(Ordering::SeqCst) {
            return Ok(());
        }
        if self
            .state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_ref()
            .is_some_and(|state| state.targets == plan.targets())
        {
            return Ok(());
        }
        self.rescan(plan)
    }
    fn rescan(&self, plan: &Plan) -> Result<()> {
        let targets = plan.targets();
        let directories = self.directories(plan)?;
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        if self.closed.load(Ordering::SeqCst) {
            return Ok(());
        }
        if state.as_ref().is_none_or(|state| state.targets != targets) {
            let mut watcher = self.watcher()?;
            for path in &directories {
                attach(&mut watcher, path)?;
            }
            *state = Some(State {
                watcher,
                targets,
                directories,
            });
        } else if let Some(state) = state.as_mut() {
            let mut attached: Vec<PathBuf> = Vec::new();
            for path in &directories {
                if let Err(error) = attach(&mut state.watcher, path) {
                    for previous in attached {
                        let _ = state.watcher.unwatch(&previous);
                    }
                    return Err(error);
                }
                if !state.directories.contains(path) {
                    attached.push(path.clone());
                }
            }
            for path in state.directories.difference(&directories) {
                let _ = state.watcher.unwatch(path);
            }
            state.directories = directories;
        }
        Ok(())
    }
    async fn changed(&self) {
        self.inbox.changed().await;
    }
    fn take(&self) -> Vec<Result<Event>> {
        self.inbox
            .take()
            .into_iter()
            .map(|event| {
                let mut event = event?;
                if event.kind == Kind::Rename {
                    event.kind = match self.tree.project(&event.path) {
                        Ok(Some(node)) if node.kind == FileKind::Directory => Kind::Directory,
                        _ => Kind::File,
                    };
                }
                Ok(event)
            })
            .collect()
    }
    fn replay(&self, events: Vec<Result<Event>>) {
        for event in events {
            self.inbox.send(event);
        }
    }
    fn close(&self) {
        self.closed.store(true, Ordering::SeqCst);
        *self.state.lock().unwrap_or_else(|e| e.into_inner()) = None;
        self.inbox.take();
    }
}

fn attach(watcher: &mut RecommendedWatcher, path: &Path) -> Result<()> {
    match watcher.watch(path, RecursiveMode::NonRecursive) {
        Ok(()) => Ok(()),
        Err(source) => Err(Error::Observer {
            path: path.into(),
            source,
        }),
    }
}

fn existing_parents(tree: &dyn SourceTree, path: &Path, repository: &Path) -> Vec<PathBuf> {
    path.ancestors()
        .skip(1)
        .filter(|path| path.starts_with(repository))
        .filter(
            |path| matches!(tree.project(path), Ok(Some(node)) if node.kind == FileKind::Directory && node.identity == *path),
        )
        .map(Path::to_owned)
        .collect()
}
