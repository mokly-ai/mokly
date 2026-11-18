//! One-shot animation ownership, phase settlement, and upload progress.

use std::io::{self, IsTerminal};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;

use mokly_cli::output::{Mode, Style};
use mokly_cli::redaction::Redactor;
use mokly_publish::accounting::Progress;
use mokly_publish::runtime::Reporter;
use mokly_sidecar::process_clock::SystemClock;

use crate::phase_format::{frame, stepped};
use crate::terminal::Terminal;

use super::{Lines, State};

impl Lines {
    pub(crate) fn new(
        style: Style,
        redactor: Arc<Redactor>,
        terminal: Arc<dyn Terminal>,
        cwd: PathBuf,
    ) -> Self {
        let state = Arc::new(Mutex::new(State::default()));
        let (stop, receiver) = mpsc::channel();
        let animate = style.mode == Mode::Rich && io::stdout().is_terminal();
        let timer = if animate {
            let state = state.clone();
            let style = style.clone();
            let terminal = terminal.clone();
            thread::Builder::new()
                .name("mokly-progress".into())
                .spawn(move || {
                    while receiver.recv_timeout(Duration::from_millis(80))
                        == Err(mpsc::RecvTimeoutError::Timeout)
                    {
                        let mut state = state.lock().unwrap_or_else(|error| error.into_inner());
                        state.frame += 1;
                        if let Some(label) = &state.label {
                            terminal.stdout(&frame(
                                &style,
                                &stepped(label, state.step),
                                state.frame,
                            ));
                        }
                    }
                })
                .ok()
        } else {
            None
        };
        Self {
            clock: Arc::new(SystemClock::new()),
            cwd,
            style,
            redactor,
            terminal,
            state,
            stop,
            timer: Mutex::new(timer),
            animate,
        }
    }
    pub(crate) fn clear(&self) {
        let _ = self.settle();
    }
    pub(super) fn settle(&self) -> Option<Duration> {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate && state.label.is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
        state.label = None;
        state.step = None;
        state
            .started
            .take()
            .map(|started| Duration::from_millis(self.clock.now_ms().saturating_sub(started)))
    }
}
impl Reporter for Lines {
    fn round(&self, _: usize) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        state.label = Some("Uploading catalogue".into());
        if self.animate {
            self.terminal
                .stdout(&frame(&self.style, "Uploading catalogue", state.frame));
        }
    }
    fn progress(&self, progress: &Progress) {
        if !self.animate {
            return;
        }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let label = progress.label();
        self.terminal
            .stdout(&frame(&self.style, &label, state.frame));
        state.label = Some(label);
    }
}
impl Drop for Lines {
    fn drop(&mut self) {
        let _ = self.stop.send(());
        if let Some(handle) = self
            .timer
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take()
        {
            let _ = handle.join();
        }
        self.clear();
    }
}
