//! Saved values remain buildable when only their editing controls exclude them.

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::controls;
use mokly_model::limits::pointer;
use mokly_model::validation::accepts;

use crate::diagnostic::{Warning, WarningSubject, json_quoted};

pub(crate) fn collect(entries: &[ModelEntry]) -> Vec<Warning> {
    let mut warnings = Vec::new();
    for entry in entries {
        let (visual, subject) = match &entry.content {
            EntryContent::Screen { visual, .. } => {
                (visual, WarningSubject::Entry(entry.metadata.path.clone()))
            }
            EntryContent::Component { visual, .. } => (
                visual,
                WarningSubject::Component(entry.metadata.path.clone()),
            ),
            _ => continue,
        };
        let bounded = controls::with_bounds(&visual.prop_schema, &visual.controls);
        let Some(properties) = &bounded.properties else {
            continue;
        };
        for key in visual.controls.keys() {
            if let Some(value) = visual.props.get(key)
                && let Some(property) = properties.get(key)
                && !accepts(property, value)
            {
                let path = pointer("", key);
                warnings.push(Warning {
                    code: "props-control-bounds",
                    subject: subject.clone(),
                    message: format!(
                        "saved prop {} is outside its control bounds",
                        json_quoted(&path)
                    ),
                });
            }
        }
    }
    warnings
}

#[cfg(test)]
#[path = "_tests_/control_warnings_tests.rs"]
mod control_warnings_tests;
