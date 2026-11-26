//! Child ownership preserves stop-kill-then-wait cleanup, including partial
//! startup drops and failed attachments.

use std::io;
use std::process::Child;
use std::sync::Arc;

use mokly_platform::error;
use mokly_platform::processes::{AttachFailure, ProcessGroups, ProcessTree, Unattached};

use crate::process_startup::StartupTiming;
use crate::workers::WorkerControl;

#[cfg_attr(test, unimock::unimock(api = ReapMock))]
pub(super) trait Reap {
    fn kill(&mut self) -> io::Result<()>;
    fn wait(&mut self) -> io::Result<()>;
}

/// The child of a failed attachment, after the stop of its tree. Its wait
/// reaps it.
impl Reap for Child {
    fn kill(&mut self) -> io::Result<()> {
        Child::kill(self)
    }
    fn wait(&mut self) -> io::Result<()> {
        Child::wait(self).map(|_| ())
    }
}

/// After attachment, a wait leaves the root unreaped. The tree reaps it when
/// its last reference drops, after the last signal of its guard.
impl Reap for Arc<ProcessTree> {
    fn kill(&mut self) -> io::Result<()> {
        self.kill_root()
    }
    fn wait(&mut self) -> io::Result<()> {
        ProcessTree::wait(self).map(|_| ())
    }
}

/// The attached tree of a sidecar, which stops and kills its root on drop.
pub(super) struct Reaper {
    tree: Arc<ProcessTree>,
    startup: Option<Startup>,
}

struct Startup {
    timing: Arc<StartupTiming>,
    groups: Arc<dyn ProcessGroups>,
    control: Option<Arc<dyn WorkerControl>>,
}

impl Reaper {
    pub(super) fn new(
        tree: Arc<ProcessTree>,
        timing: Arc<StartupTiming>,
        groups: Arc<dyn ProcessGroups>,
    ) -> Self {
        Self {
            tree,
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

    pub(super) fn wait(&mut self) {
        let _ = self.tree.wait();
    }
}

/// Retire the child of a failed attachment under the startup stop span. The
/// failure stops the whole tree first, and then the child is killed and
/// reaped. Return the cause of the failure.
pub(super) fn retire_unattached(
    failure: AttachFailure,
    timing: &StartupTiming,
    groups: &dyn ProcessGroups,
) -> error::Error {
    let span = timing.stop();
    let _scope = span.enter();
    let Unattached {
        mut child,
        source,
        stopped,
    } = failure.stop(groups);
    observe_unattached(timing, stopped);
    reap(&mut child, Some(timing));
    source
}

fn observe_unattached(timing: &StartupTiming, stopped: error::Result<()>) {
    timing.observe(stopped.is_ok());
    if let Err(error) = stopped {
        tracing::warn!(operation = %"tree.kill_unattached", %error, "could not stop sidecar startup tree");
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
        if let Some(startup) = &self.startup {
            startup.kill_tree(&self.tree);
        }
        reap(&mut self.tree, timing);
    }
}

impl Startup {
    fn kill_tree(&self, tree: &ProcessTree) {
        let stopped = self.control.as_ref().is_some_and(|control| {
            let result = control.kill();
            self.timing.observe(result.is_ok());
            if let Err(error) = &result {
                tracing::warn!(operation = %"tree.kill", %error, "could not stop sidecar startup tree");
            }
            result.is_ok()
        });
        if !stopped && (self.control.is_none() || cfg!(unix)) {
            observe_unattached(&self.timing, tree.kill_unattached(self.groups.as_ref()));
        }
    }
}
