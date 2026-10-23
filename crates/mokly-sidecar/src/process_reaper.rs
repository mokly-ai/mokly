//! Child ownership preserves kill-then-wait cleanup, including partial startup drops.

use std::io;
use std::process::Child;
use std::sync::Arc;

use crate::process_startup::StartupTiming;

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

pub(super) struct Reaper(pub(super) Child, pub(super) Option<Arc<StartupTiming>>);

impl Reaper {
    pub(super) fn started(&mut self) {
        self.1 = None;
    }

    pub(super) fn wait(&mut self) {
        let _ = self.0.wait();
    }
}

pub(super) fn reap(child: &mut dyn Reap, startup: Option<&StartupTiming>) {
    let span = startup.map(StartupTiming::stop);
    let _scope = span.as_ref().map(tracing::Span::enter);
    let killed = child.kill();
    let waited = child.wait();
    if let Some(startup) = startup {
        startup.observe(killed.is_ok() && waited.is_ok());
    }
}

impl Drop for Reaper {
    fn drop(&mut self) {
        reap(&mut self.0, self.1.as_deref());
    }
}
