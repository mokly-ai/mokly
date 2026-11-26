//! Local instance id collisions and their build warning.

use mokly_catalogue::diagnostic::{Warning, WarningSubject, json_quoted};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::usage::ComponentInstanceRecord;

pub(crate) fn first_available<T>(
    base: &str,
    mut placement: impl FnMut(&str) -> Option<T>,
) -> (String, T) {
    let mut id = base.to_owned();
    let mut number = 2;
    loop {
        if let Some(placement) = placement(&id) {
            return (id, placement);
        }
        id = format!("{base}-{number}");
        number += 1;
    }
}

pub(crate) fn numbered_warning(
    instance: &ComponentInstanceRecord,
    entry: &ModelEntry,
    hint: &str,
) -> Warning {
    let site = instance.source.as_ref().map_or_else(String::new, |source| {
        format!(
            " at {}:{}:{}",
            json_quoted(&source.path),
            source.line,
            source.column
        )
    });
    let path = entry.metadata.path.clone();
    let subject = if matches!(entry.content, EntryContent::Component { .. }) {
        WarningSubject::Component(path)
    } else {
        WarningSubject::Entry(path)
    };
    Warning {
        code: "instance-numbered",
        subject,
        message: format!(
            "component {} instance {}{site} has a numbered id; give the use a {hint} that is unique in its input scope",
            json_quoted(&instance.component_id),
            json_quoted(&instance.id),
        ),
    }
}
