//! Resolve a logical destination's effective viewport, scheme, and first flow step.

use std::collections::BTreeMap;

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::routes;

use crate::diagnostic_code::Code;
use crate::error::{Result, invalid};

pub(crate) fn route(
    entry: &ModelEntry,
    entries: &BTreeMap<String, &ModelEntry>,
    viewport: Viewport,
    scheme: ColorScheme,
) -> Result<String> {
    let path = &entry.metadata.path;
    Ok(match &entry.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
            routes::view(
                path,
                viewport,
                if visual.color_schemes.contains(&scheme) {
                    scheme
                } else {
                    ColorScheme::Light
                },
            )
        }
        EntryContent::Page => routes::document(path, ColorScheme::Light),
        EntryContent::Document { color_schemes, .. } => routes::document(
            path,
            if color_schemes.contains(&scheme) {
                scheme
            } else {
                ColorScheme::Light
            },
        ),
        EntryContent::UseCase { steps } => {
            let screen = steps
                .first()
                .and_then(|step| entries.get(&step.screen_path.to_ascii_lowercase()))
                .ok_or_else(|| invalid(Code::BuildInvalid, "use case link has no first screen"))?;
            route(screen, entries, viewport, scheme)?
        }
    })
}
