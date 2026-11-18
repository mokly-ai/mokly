//! One-shot phases hold cache notes only during the head rendering phase.

use std::time::Duration;

use mokly_catalogue::diagnostic::Warning;
use mokly_cli::build::BuildChanges;
use mokly_cli::build_output;
use mokly_cli::changes_output;
use mokly_cli::output::{Mode, bounded};
use mokly_cli::static_build::{Phase, Phases};
use mokly_compare::comparison_steps::Step;

use crate::phase_format;
use crate::phase_format::{duration, frame, stepped};

use super::{Lines, State};

impl Phases for Lines {
    fn start(&self, phase: Phase) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.release_note(&mut state);
        state.holding = matches!(phase, Phase::Rendering);
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
        if self.animate {
            self.terminal.stdout("\r\x1b[2K");
        }
        let now = self.clock.now_ms();
        if let Some(previous) = &state.label {
            self.success(&format!(
                "{previous} ({})",
                duration(
                    state
                        .started
                        .map_or(Duration::ZERO, |started| Duration::from_millis(
                            now.saturating_sub(started)
                        ))
                )
            ));
        }
        state.label = Some(label.clone());
        state.step = None;
        state.started = Some(now);
        state.frame = 0;
        self.terminal.stdout(&if self.animate {
            frame(&self.style, &label, 0)
        } else {
            format!("{}\n", bounded(&format!("  {label}…"), self.style.columns))
        });
    }
    fn step(&self, step: Step) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(label) = &state.label else {
            return;
        };
        let text = stepped(label, Some(step));
        if self.animate {
            self.terminal
                .stdout(&frame(&self.style, &text, state.frame));
        }
        state.step = Some(step);
    }
    fn note(&self, message: &str) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.holding {
            state.note.get_or_insert_with(|| message.to_owned());
        } else {
            self.emit_note(&state, message);
        }
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
    fn changes(&self, changes: &BuildChanges) {
        let elapsed = self.settle().map(duration);
        self.terminal.stderr(&changes_output::diagnostics(
            &self.style,
            changes,
            &self.redactor,
        ));
        self.terminal.stdout(&changes_output::summary_with_duration(
            &self.style,
            changes,
            &self.redactor,
            elapsed.as_deref(),
        ));
    }
    fn warnings(&self, warnings: &[Warning]) {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        self.release_note(&mut state);
        if warnings.is_empty() {
            return;
        }
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
impl Lines {
    fn release_note(&self, state: &mut State) {
        state.holding = false;
        if let Some(message) = state.note.take() {
            self.emit_note(state, &message);
        }
    }
    fn emit_note(&self, state: &State, message: &str) {
        if self.animate && state.label.is_some() {
            self.terminal.stdout("\r\x1b[2K");
        }
        self.terminal.stdout(message);
    }
    fn success(&self, text: &str) {
        self.terminal
            .stdout(&phase_format::success(&self.style, text));
    }
}
