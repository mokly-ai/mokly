//! Child ownership preserves kill-then-wait cleanup, including partial startup drops.

use std::io;
use std::process::Child;
use std::sync::Arc;

use mokly_platform::processes::ProcessGroups;

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

pub(super) struct Reaper {
    pub(super) child: Child,
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
            child,
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
        let _ = self.child.wait();
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
            startup.kill_tree(&self.child);
        }
        reap(&mut self.child, timing);
    }
}

impl Startup {
    fn kill_tree(&self, child: &Child) {
        let stopped = self.control.as_ref().is_some_and(|control| {
            let result = control.kill();
            self.timing.observe(result.is_ok());
            if let Err(error) = &result {
                tracing::warn!(operation = %"tree.kill", %error, "could not stop sidecar startup tree");
            }
            result.is_ok()
        });
        if !stopped && (self.control.is_none() || cfg!(unix)) {
            let result = self.groups.kill_unattached(child);
            self.timing.observe(result.is_ok());
            if let Err(error) = result {
                tracing::warn!(operation = %"tree.kill_unattached", %error, "could not stop sidecar startup tree");
            }
        }
    }
}
