//! A preparation task has one explicit owner and joins before releasing pending inputs.

use std::sync::{Arc, Condvar, Mutex};
use std::thread::{self, JoinHandle};

use mokly_compare::error::{Error, InternalError, Result};
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_background::PendingChanges;
use mokly_server::changes_signal::ChangeSignal;

use crate::serve_eager_admission::EagerAdmission;

/// The source phase can finish early or require adopted head evidence.
pub enum SourceCompletion {
    /// A kept match or a typed failure needs no head-dependent work.
    Finished,
    /// A different kept key also waits for the normal classification to release it.
    Head { classification: bool },
}

#[cfg_attr(test, unimock::unimock(api = PreparationWorkMock))]
pub(super) trait PreparationWork: Send + Sync {
    fn sources(&self) -> SourceCompletion;
    fn validate(&self, head: Arc<dyn RenderGeneration>);
    fn failed(&self, error: Error);
    fn reader(&self, cancel: Arc<dyn ChangeCancellation>);
    fn discard(&self);
}

#[cfg_attr(test, unimock::unimock(api = PreparationTaskMock))]
pub(super) trait PreparationTask: PendingChanges {
    /// Bind the classification before waiting for independent source work.
    fn sources_ready(&self, cancel: Arc<dyn ChangeCancellation>);
    /// Return whether the task thread finished or never started.
    fn ended(&self) -> bool;
    fn cancel(&self);
    fn head(&self, head: Arc<dyn RenderGeneration>);
    fn continue_for_classification(&self, cancel: Arc<dyn ChangeCancellation>);
    fn join(&self) -> Result<()>;
}

pub(super) trait PreparationTasks: Send + Sync {
    fn start(
        &self,
        work: Arc<dyn PreparationWork>,
        cancel: Arc<dyn ChangeCancellation>,
        phase: Arc<dyn EagerAdmission>,
    ) -> Arc<dyn PreparationTask>;
}

pub(super) struct NativeTasks;

#[derive(Default)]
struct State {
    head: Option<Arc<dyn RenderGeneration>>,
    classification: bool,
    sources: bool,
}

struct Control {
    state: Mutex<State>,
    changed: Condvar,
    cancel: Arc<dyn ChangeCancellation>,
}

impl ChangeSignal for Control {
    fn notify(&self) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.changed.notify_all();
    }
}

struct SourceFinished(Arc<Control>);
impl Drop for SourceFinished {
    fn drop(&mut self) {
        let mut state = self
            .0
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        state.sources = true;
        self.0.changed.notify_all();
    }
}

struct Task {
    work: Arc<dyn PreparationWork>,
    control: Arc<Control>,
    phase: Arc<dyn EagerAdmission>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl PreparationTasks for NativeTasks {
    fn start(
        &self,
        work: Arc<dyn PreparationWork>,
        cancellation: Arc<dyn ChangeCancellation>,
        phase: Arc<dyn EagerAdmission>,
    ) -> Arc<dyn PreparationTask> {
        let control = Arc::new(Control {
            state: Mutex::default(),
            changed: Condvar::new(),
            cancel: cancellation,
        });
        let signal: Arc<dyn ChangeSignal> = control.clone();
        control.cancel.observe(Arc::downgrade(&signal));
        let owner = control.clone();
        let job = work.clone();
        let dispatch = tracing::dispatcher::get_default(Clone::clone);
        let thread = thread::Builder::new()
            .name("mokly-base-prepare".into())
            .spawn(move || {
                tracing::dispatcher::with_default(&dispatch, || {
                    let source = {
                        let _finished = SourceFinished(owner.clone());
                        job.sources()
                    };
                    let SourceCompletion::Head { classification } = source else {
                        return;
                    };
                    let head = {
                        let mut state = owner
                            .state
                            .lock()
                            .unwrap_or_else(|error| error.into_inner());
                        while !owner.cancel.cancelled()
                            && (state.head.is_none() || classification && !state.classification)
                        {
                            state = owner
                                .changed
                                .wait(state)
                                .unwrap_or_else(|error| error.into_inner());
                        }
                        state.head.clone()
                    };
                    if !owner.cancel.cancelled()
                        && let Some(head) = head
                    {
                        job.validate(head);
                    }
                })
            });
        let thread = match thread {
            Ok(thread) => Some(thread),
            Err(source) => {
                let _finished = SourceFinished(control.clone());
                work.failed(InternalError::Io { source }.into());
                None
            }
        };
        Arc::new(Task {
            work,
            control,
            phase,
            thread: Mutex::new(thread),
        })
    }
}

impl PreparationTask for Task {
    fn sources_ready(&self, cancel: Arc<dyn ChangeCancellation>) {
        self.work.reader(cancel);
        let mut state = self
            .control
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        while !state.sources && !self.control.cancel.cancelled() {
            state = self
                .control
                .changed
                .wait(state)
                .unwrap_or_else(|error| error.into_inner());
        }
    }
    fn ended(&self) -> bool {
        self.thread
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .is_none_or(JoinHandle::is_finished)
    }
    fn cancel(&self) {
        self.control.cancel.cancel();
    }
    fn head(&self, head: Arc<dyn RenderGeneration>) {
        self.control
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .head = Some(head);
        self.control.changed.notify_all();
    }

    fn continue_for_classification(&self, cancel: Arc<dyn ChangeCancellation>) {
        self.work.reader(cancel);
        self.phase.adopt();
        self.control
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .classification = true;
        self.control.changed.notify_all();
    }

    fn join(&self) -> Result<()> {
        let mut thread = self
            .thread
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if let Some(thread) = thread.take()
            && thread.join().is_err()
        {
            self.work.failed(InternalError::Worker.into());
            return Err(InternalError::Worker.into());
        }
        Ok(())
    }
}

impl PendingChanges for Task {
    fn dispatched(&self) {
        self.phase.dispatched();
    }
    fn cancel_and_join(&self) {
        self.cancel();
        let _ = self.join();
        self.work.discard();
    }
}

#[cfg(test)]
#[path = "_tests_/eager_task_tests.rs"]
mod eager_task_tests;

#[cfg(test)]
#[path = "_tests_/eager_source_wait_tests.rs"]
mod eager_source_wait_tests;
