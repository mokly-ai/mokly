//! One owner for one-shot phases, warnings, progress, and durable completion.

use std::io::{self, IsTerminal};
use std::path::Path;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::{Duration, Instant};

use mokly_catalogue::config::relative;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build_output;
use mokly_cli::output::{Mode, Style, bounded};
use mokly_cli::publication::command::BuildReporter;
use mokly_cli::redaction::Redactor;
use mokly_cli::static_build::{Phase, Phases};
use mokly_model::output::artifact::Artifact;
use mokly_publish::accounting::{Progress, Receipt};
use mokly_publish::completion::Outcome;
use mokly_publish::runtime::Reporter;

use crate::terminal::Terminal;

pub(super) struct Lines {
    style: Style,
    redactor: Arc<Redactor>,
    terminal: Arc<dyn Terminal>,
    state: Arc<Mutex<State>>,
    stop: mpsc::Sender<()>,
    timer: Mutex<Option<thread::JoinHandle<()>>>,
    animate: bool,
}
#[derive(Default)]
struct State {
    label: Option<String>,
    started: Option<Instant>,
    frame: usize,
}

impl Lines {
    pub(super) fn new(style: Style, redactor: Arc<Redactor>, terminal: Arc<dyn Terminal>) -> Self {
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
                            terminal.stdout(&frame(&style, label, state.frame));
                        }
                    }
                })
                .ok()
        } else {
            None
        };
        Self {
            style,
            redactor,
            terminal,
            state,
            stop,
            timer: Mutex::new(timer),
            animate,
        }
    }
    pub(super) fn clear(&self) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate && state.label.is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
        state.label = None;
        state.started = None;
    }
    pub(super) fn built(&self, artifact: &Artifact, root: &Path, elapsed: Duration) {
        let directory = self.redactor.safe(&relative(&artifact.directory, root));
        if self.style.mode == Mode::Plain {
            self.terminal.stdout(&format!(
                "Built Mokly to {directory} ({} files).\n",
                artifact.files.len()
            ));
        } else {
            self.success(&format!(
                "Built Mokly to {directory} · {} files ({})",
                artifact.files.len(),
                duration(elapsed)
            ));
        }
        self.terminal
            .stdout("Deploy this directory at your site's root with your hosting provider.\n");
    }
    pub(super) fn published(&self, receipt: &Receipt, elapsed: Duration) {
        self.clear();
        if self.style.mode == Mode::Plain {
            self.terminal.stdout(&format!("{}\n", receipt.summary()));
        } else {
            let message = if receipt.completion.outcome == Outcome::AlreadyPublished {
                "Mokly catalogue already published for this commit".into()
            } else {
                format!(
                    "Published Mokly catalogue · {} {} uploaded, {} unchanged",
                    receipt.uploaded,
                    if receipt.uploaded == 1 {
                        "file"
                    } else {
                        "files"
                    },
                    receipt.unchanged
                )
            };
            self.success(&format!("{message} ({})", duration(elapsed)));
        }
        if let Some(url) = &receipt.completion.viewer_url {
            self.terminal
                .stdout(&format!("{}\n", self.redactor.safe(url)));
        }
    }
    fn success(&self, text: &str) {
        let glyph = if self.style.ascii { "+" } else { "✔" };
        let glyph = if self.style.color {
            format!("\x1b[32m{glyph}\x1b[0m")
        } else {
            glyph.into()
        };
        self.terminal.stdout(&format!(
            "{}\n",
            bounded(&format!("  {glyph} {text}"), self.style.columns)
        ));
    }
}
impl Phases for Lines {
    fn start(&self, phase: Phase) {
        if self.style.mode == Mode::Plain {
            return;
        }
        let label = self.redactor.safe(&match phase {
            Phase::Configuration => "Loading configuration".into(),
            Phase::Rendering => "Rendering catalogue".into(),
            Phase::Comparing(base) => format!("Comparing with {base}"),
            Phase::Writing => "Writing static output".into(),
            Phase::PreparingUpload => "Preparing upload".into(),
            Phase::Uploading => "Uploading catalogue".into(),
        });
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate {
            self.terminal.stdout("\r\x1b[2K");
        }
        if let Some(previous) = &state.label {
            self.success(&format!(
                "{previous} ({})",
                duration(
                    state
                        .started
                        .map_or(Duration::ZERO, |started| started.elapsed())
                )
            ));
        }
        state.label = Some(label.clone());
        state.started = Some(Instant::now());
        state.frame = 0;
        self.terminal.stdout(&if self.animate {
            frame(&self.style, &label, 0)
        } else {
            format!("{}\n", bounded(&format!("  {label}…"), self.style.columns))
        });
    }
    fn diagnostic(&self, message: &str) {
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate {
            self.terminal.stdout("\r\x1b[2K");
        }
        let message = self.redactor.safe(message);
        let text = if self.style.mode == Mode::Rich {
            bounded(&message, self.style.columns)
        } else {
            message
        };
        self.terminal.stderr(&format!("{text}\n"));
    }
    fn warnings(&self, warnings: &[Warning]) {
        if warnings.is_empty() {
            return;
        }
        let _state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if self.animate {
            self.terminal.stdout("\r\x1b[2K");
        }
        self.terminal.stderr(&build_output::warnings(
            &self.style,
            warnings,
            &self.redactor,
        ));
    }
}
impl BuildReporter for Lines {
    fn build_directory(&self, directory: &Path) {
        self.terminal.stdout(&format!(
            "Mokly publish build: {}\n",
            self.redactor.safe(&directory.to_string_lossy())
        ));
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
fn frame(style: &Style, label: &str, index: usize) -> String {
    let frames = if style.ascii {
        &["|", "/", "-", "\\"][..]
    } else {
        &["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][..]
    };
    format!(
        "\r\x1b[2K{}",
        bounded(
            &format!("  {} {label}", frames[index % frames.len()]),
            style.columns
        )
    )
}
fn duration(value: Duration) -> String {
    if value.as_secs() == 0 {
        format!("{}ms", value.as_micros().saturating_add(500) / 1_000)
    } else if value.as_secs() < 60 {
        format!("{:.1}s", value.as_secs_f64())
    } else {
        format!("{}m {:02}s", value.as_secs() / 60, value.as_secs() % 60)
    }
}

#[cfg(test)]
#[path = "_tests_/one_shot_tests.rs"]
mod one_shot_tests;
