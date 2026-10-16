//! Plain product details for static failures, with typed recovery structure.

use std::path::Path;

use mokly_static::error::{Error, InternalError};
use mokly_static::inspector_error::InspectorFailure;

use crate::codes::Code;

/// Static ownership and recovery failures retain export-invalid; author metadata is build-invalid.
pub fn code(error: &Error) -> Code {
    match error {
        Error::ModuleSyntax { .. }
        | Error::ModuleReference { .. }
        | Error::ModuleEncoding { .. } => Code::ViewerUnavailable,
        Error::Empty
        | Error::Cancelled
        | Error::Inspector {
            reason: InspectorFailure::Reserved { .. },
            ..
        } => Code::BuildInvalid,
        _ => Code::ExportInvalid,
    }
}

/// Render each cause once without Rust crate prefixes or Debug-quoted display paths.
pub fn detail(error: &Error) -> String {
    match error {
        Error::ModuleSyntax { .. }
        | Error::ModuleReference { .. }
        | Error::ModuleEncoding { .. } => format!(
            "{} Build or reinstall the matching @mokly/viewer package and retry.",
            without_prefixes(&error.to_string())
        ),
        Error::Destination { path } => format!("Unsafe output directory: {}.", display_path(path)),
        Error::Ownership { path } => format!(
            "Invalid export ownership inventory: {}.",
            display_path(path)
        ),
        Error::Unexpected { path } => format!(
            "Unexpected or unsafe output entry at {}.",
            display_path(path)
        ),
        Error::Reserved { path } => format!(
            "Output is reserved at {}. Confirm no writer is active and inspect its backup before recovery.",
            display_path(path)
        ),
        Error::Replaced { path } => format!(
            "Output changed during the build: {}. Retry after checking the directory.",
            display_path(path)
        ),
        Error::InputsChanged { path } => format!(
            "Inputs changed during the build: {}. Build again.",
            display_path(path)
        ),
        Error::Recovery {
            primary,
            cleanup,
            path,
        } => format!(
            "{}\nRecovery failed: {}\nInspect retained recovery path {}.",
            detail(primary),
            detail(cleanup),
            display_path(path)
        ),
        Error::Installed { source, path } => format!(
            "The new site is installed. Cleanup failed: {}\nInspect remaining recovery path {}.",
            detail(source),
            display_path(path)
        ),
        Error::Unowned { path, entries } => format!(
            "Output is not owned by Mokly: {}.{}",
            display_path(path),
            listed(entries)
        ),
        Error::UnexpectedEntries { path, entries } => format!(
            "Unexpected output entries in {}.{}",
            display_path(path),
            listed(entries)
        ),
        Error::Inspector { route, reason } => {
            format!("{route}: {}", without_prefixes(&reason.to_string()))
        }
        Error::Internal(InternalError::Rename { source }) => format!(
            "Exclusive rename failed: {}",
            without_prefixes(&source.to_string())
        ),
        _ => without_prefixes(&error.to_string()),
    }
}

fn listed(entries: &[String]) -> String {
    let mut entries = entries.to_vec();
    entries.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    entries.dedup();
    let mut text = String::new();
    for entry in entries.iter().take(20) {
        text.push_str(&format!("\n  - {}", controls(entry)));
    }
    if entries.len() > 20 {
        text.push_str(&format!("\n  … {} other entries.", entries.len() - 20));
    }
    text
}

/// Remove implementation tags for display only; classification uses enum variants.
pub fn without_prefixes(text: &str) -> String {
    let mut result = String::new();
    let mut rest = text;
    while let Some(start) = rest.find("[mokly-") {
        result.push_str(&rest[..start]);
        let Some(end) = rest[start..].find("] ") else {
            result.push_str(&rest[start..]);
            return result;
        };
        rest = &rest[start + end + 2..];
    }
    result.push_str(rest);
    result
}

/// Display a path with its native separators and escaped control characters.
pub fn display_path(path: &Path) -> String {
    controls(&path.to_string_lossy())
}

fn controls(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_control() {
                format!("\\u{:04x}", u32::from(character))
            } else {
                character.to_string()
            }
        })
        .collect()
}
