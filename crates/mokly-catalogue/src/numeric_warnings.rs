//! Warn on binary64 normalization after final entry paths are known.

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::data::{Props, unsafe_integer_paths};

use crate::diagnostic::{Warning, WarningSubject};

pub(crate) fn collect(entries: &[ModelEntry]) -> Vec<Warning> {
    let mut warnings = Vec::new();
    for entry in entries {
        let visual = match &entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => visual,
            _ => continue,
        };
        warnings.extend(for_entry(&visual.props, entry));
    }
    warnings
}

/// Diagnose each unsafe complete prop value without exposing its data in the message.
pub fn for_entry(props: &Props, entry: &ModelEntry) -> Vec<Warning> {
    let subject = if matches!(entry.content, EntryContent::Component { .. }) {
        WarningSubject::Component(entry.metadata.path.clone())
    } else {
        WarningSubject::Entry(entry.metadata.path.clone())
    };
    unsafe_integer_paths(props).into_iter().map(|path| Warning {
        code: "props-unsafe-integer",
        subject: subject.clone(),
        message: format!("prop {path:?} is outside the JavaScript safe integer range and uses the nearest binary64 value"),
    }).collect()
}
