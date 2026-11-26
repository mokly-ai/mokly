//! Child ownership preserves kill-then-wait cleanup, including partial startup drops.

use std::io;
use std::process::Child;
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::processes::{ProcessGroup, ProcessGroups, ProcessTree};

use crate::process_startup::StartupTiming;
use crate::workers::WorkerControl;

#[cfg_attr(test, unimock::unimock(api = ReapMock))]
pub(super) trait Reap {
    fn kill(&mut self) -> io::Result<()>;
    fn wait(&mut self) -> io::Result<()>;
}

impl Reap for Child {
    fn kill(&mut self) -> io::Result<()> {
        Child::kill(self)
    }
    fn wait(&mut self) -> io::Result<()> {
        Child::wait(self).map(|_| ())
    }
}

/// The direct child before attachment, then the tree that owns its reap.
pub(super) enum Root {
    Child(Child),
    Tree(Arc<ProcessTree>),
}

/// After attachment, a wait leaves the root unreaped. The tree reaps it when
/// its last reference drops, after the last signal of its guard.
impl Reap for Root {
    fn kill(&mut self) -> io::Result<()> {
        match self {
            Self::Child(child) => child.kill(),
            Self::Tree(tree) => tree.kill_root(),
        }
    }
    fn wait(&mut self) -> io::Result<()> {
        match self {
            Self::Child(child) => child.wait().map(|_| ()),
            Self::Tree(tree) => tree.wait().map(|_| ()),
        }
    }
}

impl Root {
    fn kill_unattached(&self, groups: &dyn ProcessGroups) -> error::Result<()> {
        match self {
            Self::Child(child) => groups.kill_unattached(child),
            Self::Tree(tree) => tree.kill_unattached(groups),
        }
    }
}

pub(super) struct Reaper {
    root: Option<Root>,
    startup: Option<Startup>,
}

struct Startup {
    timing: Arc<StartupTiming>,
    groups: Arc<dyn ProcessGroups>,
    control: Option<Arc<dyn WorkerControl>>,
}

impl Reaper {
    pub(super) fn new(
        child: Child,
        timing: Arc<StartupTiming>,
        groups: Arc<dyn ProcessGroups>,
    ) -> Self {
        Self {
            root: Some(Root::Child(child)),
            startup: Some(Startup {
                timing,
                groups,
                control: None,
            }),
        }
    }

    pub(super) fn attached(&mut self, control: Arc<dyn WorkerControl>) {
        if let Some(startup) = &mut self.startup {
            startup.control = Some(control);
        }
    }

    pub(super) fn started(&mut self) {
        self.startup = None;
    }

    /// The direct child while it is not attached yet.
    pub(super) fn child(&mut self) -> Option<&mut Child> {
        match &mut self.root {
            Some(Root::Child(child)) => Some(child),
            _ => None,
        }
    }

    /// Hand the direct child and its guard to one tree, and return it.
    pub(super) fn own(&mut self, group: Box<dyn ProcessGroup>) -> Option<Arc<ProcessTree>> {
        let child = match self.root.take() {
            Some(Root::Child(child)) => child,
            root => {
                self.root = root;
                return None;
            }
        };
        let tree = Arc::new(ProcessTree::new(child, group));
        self.root = Some(Root::Tree(Arc::clone(&tree)));
        Some(tree)
    }

    pub(super) fn wait(&mut self) {
        if let Some(root) = &mut self.root {
            let _ = root.wait();
        }
    }
}

pub(super) fn reap(child: &mut dyn Reap, startup: Option<&StartupTiming>) {
    let span = startup.map(StartupTiming::stop);
    let _scope = span.as_ref().map(tracing::Span::enter);
    let killed = child.kill();
    let waited = child.wait();
    if let Err(error) = &killed {
        tracing::warn!(operation = %"child.kill", %error, "could not clean up sidecar child");
    }
    if let Err(error) = &waited {
        tracing::warn!(operation = %"child.wait", %error, "could not clean up sidecar child");
    }
    if let Some(startup) = startup {
        startup.observe(killed.is_ok() && waited.is_ok());
    }
}

impl Drop for Reaper {
    fn drop(&mut self) {
        let timing = self.startup.as_ref().map(|startup| startup.timing.as_ref());
        let span = timing.map(StartupTiming::stop);
        let _scope = span.as_ref().map(tracing::Span::enter);
        let Some(root) = &mut self.root else {
            return;
        };
        if let Some(startup) = &self.startup {
            startup.kill_tree(root);
        }
        reap(root, timing);
    }
}

impl Startup {
    fn kill_tree(&self, root: &Root) {
        let stopped = self.control.as_ref().is_some_and(|control| {
            let result = control.kill();
            self.timing.observe(result.is_ok());
            if let Err(error) = &result {
                tracing::warn!(operation = %"tree.kill", %error, "could not stop sidecar startup tree");
            }
            result.is_ok()
        });
        if !stopped && (self.control.is_none() || cfg!(unix)) {
            let result = root.kill_unattached(self.groups.as_ref());
            self.timing.observe(result.is_ok());
            if let Err(error) = result {
                tracing::warn!(operation = %"tree.kill_unattached", %error, "could not stop sidecar startup tree");
            }
        }
    }
}
