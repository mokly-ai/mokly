//! Source-owned diagnostic text shares the pending record while head text stays immediate.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, Weak};

use mokly_sidecar::operations::Operation;
use mokly_sidecar::workers::Diagnostics;

use crate::serve_eager_events::PreparationEvents;

pub(super) trait DiagnosticRouting: Diagnostics {
    fn directory(&self, root: &Path, directory: &Path) -> bool;
    fn prepare(&self, root: &Path, events: Arc<dyn PreparationEvents>);
    fn finish(&self, root: &Path, events: &Arc<dyn PreparationEvents>, accepted: bool);
    fn normal(&self, root: &Path);
}

#[derive(Default, PartialEq, Eq)]
enum Delivery {
    Pending,
    #[default]
    Normal,
    Suppressed,
}

#[derive(Default)]
struct Route {
    owner: Option<Weak<dyn PreparationEvents>>,
    delivery: Delivery,
    readers: usize,
}

type Routes = Arc<Mutex<BTreeMap<PathBuf, Route>>>;

pub(super) struct RootDiagnostics {
    inner: Arc<dyn Diagnostics>,
    routes: Routes,
}

impl RootDiagnostics {
    pub(super) fn new(inner: Arc<dyn Diagnostics>) -> Self {
        Self {
            inner,
            routes: Arc::default(),
        }
    }
}

impl Diagnostics for RootDiagnostics {
    fn for_source_root(&self, root: &Path) -> Option<Arc<dyn Diagnostics>> {
        self.routes
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .entry(root.into())
            .or_default()
            .readers += 1;
        Some(Arc::new(RootSink {
            inner: self.inner.clone(),
            root: root.into(),
            routes: self.routes.clone(),
        }))
    }
    fn emit(&self, message: &str) {
        self.inner.emit(message);
    }
    fn timing(&self, line: &str) {
        self.inner.timing(line);
    }
    fn operation(&self, operation: Operation, pid: u32) {
        self.inner.operation(operation, pid);
    }
}

impl DiagnosticRouting for RootDiagnostics {
    fn directory(&self, root: &Path, directory: &Path) -> bool {
        let target = {
            let routes = self
                .routes
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            match routes.get(root) {
                Some(route) if route.delivery == Delivery::Suppressed => return true,
                Some(route) if route.delivery == Delivery::Pending => {
                    route.owner.as_ref().and_then(Weak::upgrade)
                }
                _ => return false,
            }
        };
        if let Some(target) = target {
            target.opened(directory);
        }
        true
    }
    fn prepare(&self, root: &Path, events: Arc<dyn PreparationEvents>) {
        let mut routes = self
            .routes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let route = routes.entry(root.into()).or_default();
        route.owner = Some(Arc::downgrade(&events));
        route.delivery = Delivery::Pending;
    }
    fn finish(&self, root: &Path, events: &Arc<dyn PreparationEvents>, accepted: bool) {
        let mut routes = self
            .routes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let Some(route) = routes.get_mut(root) else {
            return;
        };
        if !route
            .owner
            .as_ref()
            .is_some_and(|owner| owner.ptr_eq(&Arc::downgrade(events)))
        {
            return;
        }
        route.delivery = if accepted {
            Delivery::Normal
        } else {
            Delivery::Suppressed
        };
        if route.readers == 0 {
            routes.remove(root);
        }
    }
    fn normal(&self, root: &Path) {
        let mut routes = self
            .routes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let Some(route) = routes.get_mut(root) else {
            return;
        };
        route.owner = None;
        route.delivery = Delivery::Normal;
        if route.readers == 0 {
            routes.remove(root);
        }
    }
}

struct RootSink {
    inner: Arc<dyn Diagnostics>,
    root: PathBuf,
    routes: Routes,
}

impl Diagnostics for RootSink {
    fn emit(&self, message: &str) {
        let route = {
            let routes = self
                .routes
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            routes
                .get(&self.root)
                .map(|route| match route.delivery {
                    Delivery::Pending => route.owner.as_ref().and_then(Weak::upgrade).map(Some),
                    Delivery::Normal => Some(None),
                    Delivery::Suppressed => None,
                })
                .unwrap_or(Some(None))
        };
        match route {
            Some(Some(events)) => events.diagnostic(message.into()),
            Some(None) => self.inner.emit(message),
            None => {}
        }
    }
    fn timing(&self, line: &str) {
        self.inner.timing(line);
    }
    fn operation(&self, operation: Operation, pid: u32) {
        self.inner.operation(operation, pid);
    }
}

impl Drop for RootSink {
    fn drop(&mut self) {
        let mut routes = self
            .routes
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(route) = routes.get_mut(&self.root) {
            route.readers -= 1;
            if route.readers == 0
                && (route.delivery != Delivery::Pending
                    || route
                        .owner
                        .as_ref()
                        .is_none_or(|owner| owner.strong_count() == 0))
            {
                routes.remove(&self.root);
            }
        }
    }
}
