//! One owner for one-shot phases, warnings, progress, and durable completion.

use std::path::PathBuf;
use std::sync::{Arc, Mutex, mpsc};
use std::thread;

use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_compare::comparison_steps::Step;
use mokly_sidecar::workers::Clock;

use crate::terminal::Terminal;

mod output;
mod phases;
mod progress;

pub(super) struct Lines {
    clock: Arc<dyn Clock>,
    cwd: PathBuf,
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
    step: Option<Step>,
    started: Option<u64>,
    frame: usize,
    note: Option<String>,
    holding: bool,
}

#[cfg(test)]
#[path = "../_tests_/one_shot_tests.rs"]
mod one_shot_tests;

#[cfg(test)]
#[path = "../_tests_/one_shot_cache_tests.rs"]
mod cache_tests;

#[cfg(test)]
#[path = "../_tests_/comparison_duration_tests.rs"]
mod comparison_duration_tests;

#[cfg(test)]
#[path = "../_tests_/publication_progress_tests.rs"]
mod publication_progress_tests;
