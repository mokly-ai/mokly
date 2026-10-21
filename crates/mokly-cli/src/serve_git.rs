//! Serve owns every Git pipe and drains active runners in its ordered shutdown hook.

use std::io::Write;
use std::sync::{Arc, Condvar, Mutex};

use mokly_git::command::{self, Output, Request, Runner};
use mokly_git::control::{Cancellation, SystemClock};
use mokly_git::error::{Error, Result};
use mokly_git::system::SystemRunner;
use mokly_platform::processes::SystemProcessGroups;
use mokly_server::changes::ChangeCancellation;

#[cfg_attr(test, unimock::unimock(api = GitWorkMock))]
pub(super) trait GitWork: Send + Sync {
    fn runner(&self, cancellation: Arc<dyn ChangeCancellation>) -> Arc<dyn Runner>;
    fn cancel(&self);
}

#[derive(Default)]
struct State {
    closed: bool,
    active: usize,
}

pub(super) struct ServeGit {
    state: Arc<(Mutex<State>, Condvar)>,
    runners: Arc<dyn GitRunners>,
}

#[cfg_attr(test, unimock::unimock(api = GitRunnersMock))]
pub(super) trait GitRunners: Send + Sync {
    fn create(&self, cancellation: Arc<dyn Cancellation>) -> Arc<dyn Runner>;
}

pub(super) struct SystemRunners;
impl GitRunners for SystemRunners {
    fn create(&self, cancellation: Arc<dyn Cancellation>) -> Arc<dyn Runner> {
        Arc::new(SystemRunner {
            groups: Arc::new(SystemProcessGroups),
            clock: Arc::new(SystemClock::default()),
            cancellation,
        })
    }
}

impl ServeGit {
    pub(super) fn new(runners: Arc<dyn GitRunners>) -> Self {
        Self {
            state: Arc::default(),
            runners,
        }
    }
}

impl GitWork for ServeGit {
    fn runner(&self, cancellation: Arc<dyn ChangeCancellation>) -> Arc<dyn Runner> {
        Arc::new(Tracked {
            state: self.state.clone(),
            inner: self.runners.create(Arc::new(Cancel {
                state: self.state.clone(),
                generation: cancellation,
            })),
        })
    }
    fn cancel(&self) {
        let (state, settled) = self.state.as_ref();
        let mut state = state.lock().unwrap_or_else(|error| error.into_inner());
        state.closed = true;
        while state.active > 0 {
            state = settled
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }
}

struct Cancel {
    state: Arc<(Mutex<State>, Condvar)>,
    generation: Arc<dyn ChangeCancellation>,
}
impl Cancellation for Cancel {
    fn cancelled(&self) -> bool {
        self.generation.cancelled()
            || self
                .state
                .0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .closed
    }
}

struct Tracked {
    state: Arc<(Mutex<State>, Condvar)>,
    inner: Arc<dyn Runner>,
}
struct Active {
    state: Arc<(Mutex<State>, Condvar)>,
}
impl Drop for Active {
    fn drop(&mut self) {
        self.state
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .active -= 1;
        self.state.1.notify_all();
    }
}
impl Tracked {
    fn enter(&self) -> Result<Active> {
        let mut state = self
            .state
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if state.closed {
            return Err(Error::Cancelled);
        }
        state.active += 1;
        Ok(Active {
            state: self.state.clone(),
        })
    }
}
impl Runner for Tracked {
    fn run(&self, request: &Request) -> Result<Output> {
        let _active = self.enter()?;
        self.inner.run(request)
    }
    fn digest(&self, request: &Request) -> Result<String> {
        let _active = self.enter()?;
        self.inner.digest(request)
    }
    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()> {
        let _active = self.enter()?;
        self.inner.copy(request, output, bytes)
    }
    fn run_cancellable(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
    ) -> Result<Output> {
        let _active = self.enter()?;
        self.inner.run_cancellable(request, cancellation)
    }
    fn run_cancellable_with_environment(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, std::ffi::OsString)],
    ) -> Result<Output> {
        let _active = self.enter()?;
        self.inner
            .run_cancellable_with_environment(request, cancellation, environment)
    }
    fn run_cancellable_with_environment_timeout(
        &self,
        request: &Request,
        cancellation: &dyn command::Cancellation,
        environment: &[(&str, std::ffi::OsString)],
        timeout: std::time::Duration,
    ) -> Result<Output> {
        let _active = self.enter()?;
        self.inner.run_cancellable_with_environment_timeout(
            request,
            cancellation,
            environment,
            timeout,
        )
    }
}

#[cfg(test)]
#[path = "_tests_/serve_git_tests.rs"]
mod serve_git_tests;
