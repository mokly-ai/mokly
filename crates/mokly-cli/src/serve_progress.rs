//! One Serve terminal owner erases progress before every durable output line.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_steps::Step;
use mokly_server::changes::{ChangeCancellation, ChangeCommit, ChangeRun};
use mokly_sidecar::workers::Diagnostics;
use tokio::sync::watch;
use tokio::time;

use crate::phase_format::{frame, stepped};
use crate::terminal::Terminal;

#[cfg_attr(test, unimock::unimock(api = ProgressMock))]
#[async_trait]
pub(super) trait Progress: Send + Sync {
    fn begin(&self, label: &str, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn ChangeRun>;
    /// Show `step` beside the label that `cancel` began, while that label owns the line.
    fn step(&self, cancel: &Arc<dyn ChangeCancellation>, step: Step);
    async fn animate(&self, stop: watch::Receiver<bool>);
}

struct Label {
    id: u64,
    text: String,
    step: Option<Step>,
    frame: usize,
    cancel: Arc<dyn ChangeCancellation>,
}
#[derive(Default)]
struct State {
    next: u64,
    label: Option<Label>,
    closed: bool,
}

pub(super) struct ServeProgress {
    state: Arc<Mutex<State>>,
    terminal: Arc<dyn Terminal>,
    cancellation: Arc<dyn Cancellation>,
    style: Style,
    animate: bool,
}
impl ServeProgress {
    pub(super) fn new(
        style: Style,
        terminal: Arc<dyn Terminal>,
        cancellation: Arc<dyn Cancellation>,
        tty: bool,
    ) -> Self {
        let animate = style.mode == Mode::Rich && tty;
        Self {
            state: Arc::new(Mutex::new(State::default())),
            terminal,
            cancellation,
            style,
            animate,
        }
    }
    pub(super) fn diagnostics(self: Arc<Self>, redactor: Arc<Redactor>) -> Arc<dyn Diagnostics> {
        Arc::new(ServeDiagnostics {
            style: self.style.clone(),
            redactor,
            terminal: self,
        })
    }
    fn write(&self, text: &str, error: bool) {
        if text.is_empty() {
            return;
        }
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate && state.label.is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
        if error {
            self.terminal.stderr(text);
        } else {
            self.terminal.stdout(text);
        }
    }
    fn tick(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(label) = &mut state.label else {
            return;
        };
        if label.cancel.cancelled() || self.cancellation.requested() {
            self.terminal.stdout("\r\x1b[2K");
            state.label = None;
            return;
        }
        label.frame = label.frame.wrapping_add(1);
        self.terminal.stdout(&frame(
            &self.style,
            &stepped(&label.text, label.step),
            label.frame,
        ));
    }
}
impl Terminal for ServeProgress {
    fn stdout(&self, text: &str) {
        self.write(text, false);
    }
    fn stderr(&self, text: &str) {
        self.write(text, true);
    }
    fn raw_mode(&self, enabled: bool) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.terminal.raw_mode(enabled);
    }
}

#[async_trait]
impl Progress for ServeProgress {
    fn begin(&self, label: &str, cancel: Arc<dyn ChangeCancellation>) -> Box<dyn ChangeRun> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.style.mode == Mode::Plain
            || state.closed
            || cancel.cancelled()
            || self.cancellation.requested()
        {
            return Box::new(EmptyRun);
        }
        if self.animate && state.label.is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
        state.next = state.next.wrapping_add(1);
        let id = state.next;
        state.label = Some(Label {
            id,
            text: label.into(),
            step: None,
            frame: 0,
            cancel,
        });
        self.terminal.stdout(&if self.animate {
            frame(&self.style, label, 0)
        } else {
            format!("{}\n", bounded(&format!("  {label}…"), self.style.columns))
        });
        Box::new(Run {
            state: self.state.clone(),
            terminal: self.terminal.clone(),
            animate: self.animate,
            id,
        })
    }
    fn step(&self, cancel: &Arc<dyn ChangeCancellation>, step: Step) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(label) = state.label.as_mut() else {
            return;
        };
        if !Arc::ptr_eq(&label.cancel, cancel)
            || label.cancel.cancelled()
            || self.cancellation.requested()
        {
            return;
        }
        label.step = Some(step);
        if self.animate {
            self.terminal.stdout(&frame(
                &self.style,
                &stepped(&label.text, label.step),
                label.frame,
            ));
        }
    }
    async fn animate(&self, mut stop: watch::Receiver<bool>) {
        if !self.animate {
            return;
        }
        let period = Duration::from_millis(80);
        let mut interval = time::interval_at(time::Instant::now() + period, period);
        interval.set_missed_tick_behavior(time::MissedTickBehavior::Skip);
        while !*stop.borrow() && stop.has_changed().is_ok() && !self.cancellation.requested() {
            tokio::select! {
                biased;
                _ = stop.changed() => {},
                _ = interval.tick() => self.tick(),
            }
        }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.closed = true;
        if state.label.take().is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
    }
}

struct Run {
    state: Arc<Mutex<State>>,
    terminal: Arc<dyn Terminal>,
    animate: bool,
    id: u64,
}
impl ChangeRun for Run {
    fn finish(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state
            .label
            .as_ref()
            .is_some_and(|label| label.id == self.id)
        {
            if self.animate {
                self.terminal.stdout("\r\x1b[2K");
            }
            state.label = None;
        }
    }
}
impl Drop for Run {
    fn drop(&mut self) {
        self.finish();
    }
}
struct EmptyRun;
impl ChangeRun for EmptyRun {
    fn finish(&self) {}
}

pub(super) struct TerminalEvent<'a>(pub(super) &'a dyn Fn());
impl ChangeCommit for TerminalEvent<'_> {
    fn apply(&self) -> bool {
        (self.0)();
        true
    }
}

struct ServeDiagnostics {
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) redactor: Arc<Redactor>,
    pub(super) style: Style,
}
impl Diagnostics for ServeDiagnostics {
    fn emit(&self, message: &str) {
        let safe = self.redactor.safe(message);
        let text = if self.style.mode == Mode::Rich {
            bounded(&safe, self.style.columns)
        } else {
            safe
        };
        self.terminal.stderr(&format!("{text}\n"));
    }
}

#[cfg(test)]
#[path = "_tests_/serve_progress_tests.rs"]
mod serve_progress_tests;
