//! Last known PostCSS child phases used in timeout diagnostics.

use std::sync::{Arc, Mutex};

use serde::Deserialize;

const PREFIX: &str = "[mokly:postcss-phase] ";
const PHASES: [&str; 4] = [
    "spawn",
    "config-load",
    "plugin-construction",
    "stylesheet-run",
];

#[derive(Clone, Default)]
pub(super) struct PhaseState(Arc<Mutex<State>>);

#[derive(Default)]
struct State {
    records: [Option<Record>; 4],
}

#[derive(Clone, Debug, Deserialize)]
struct Record {
    phase: String,
    event: String,
    #[serde(rename = "elapsedMs")]
    elapsed_ms: f64,
    #[serde(rename = "durationMs")]
    duration_ms: Option<f64>,
}

impl PhaseState {
    pub(super) fn reset_stylesheet(&self) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .records[3] = None;
    }

    pub(super) fn record(&self, line: &str) -> bool {
        let Some(payload) = line.strip_prefix(PREFIX) else {
            return false;
        };
        let Ok(record) = serde_json::from_str::<Record>(payload) else {
            return false;
        };
        let Some(index) = PHASES.iter().position(|phase| *phase == record.phase) else {
            return false;
        };
        if !matches!(record.event.as_str(), "start" | "end") {
            return false;
        }
        let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        state.records[index] = Some(record);
        true
    }

    pub(super) fn summary(&self) -> Option<String> {
        let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        if state.records.iter().all(Option::is_none) {
            return None;
        }
        let phases = PHASES
            .iter()
            .zip(&state.records)
            .map(|(name, record)| match record {
                Some(record) if record.event == "end" => format!(
                    "{name}=complete {:.0}ms",
                    record.duration_ms.unwrap_or(record.elapsed_ms)
                ),
                Some(record) => format!("{name}=running at {:.0}ms", record.elapsed_ms),
                None => format!("{name}=not-started"),
            })
            .collect::<Vec<_>>()
            .join(", ");
        Some(format!("PostCSS phases: {phases}"))
    }
}

#[cfg(test)]
#[path = "_tests_/postcss_phase_tests.rs"]
mod postcss_phase_tests;
