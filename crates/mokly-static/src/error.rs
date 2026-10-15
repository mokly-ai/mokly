//! Typed static-output failures and retained recovery causes.

use std::io;
use std::path::{Path, PathBuf};

use mokly_graph::error::GraphError;
use mokly_model::output::error::FormatError;
use thiserror::Error;

use crate::inspector_error::InspectorFailure;

/// Static output result.
pub type Result<T> = std::result::Result<T, Error>;

/// Failures that preserve the existing site or name retained recovery paths.
#[derive(Debug, Error)]
pub enum Error {
    /// Output overlaps protected inputs or escapes its allowed root.
    #[error("[mokly-static] Unsafe output directory: {}.", .path.display())]
    Destination {
        /// Requested destination.
        path: PathBuf,
    },
    /// Nonempty output has no valid regular ownership marker.
    #[error("[mokly-static] Output is not owned by Mokly: {}.", .path.display())]
    Unowned {
        /// Refused output.
        path: PathBuf,
        /// Known unexpected entries, relative to output.
        entries: Vec<String>,
    },
    /// A regular marker could not authorize replacement.
    #[error("[mokly-static] Invalid export ownership inventory: {}.", .path.display())]
    Ownership {
        /// Refused output.
        path: PathBuf,
    },
    /// An unlisted or unsafe entry must survive replacement.
    #[error("[mokly-static] Unexpected or unsafe output entry at {}.", .path.display())]
    Unexpected {
        /// Entry requiring user recovery.
        path: PathBuf,
    },
    /// The actual output contains entries outside its ownership inventory.
    #[error("[mokly-static] Unexpected output entries in {}.", .path.display())]
    UnexpectedEntries {
        /// Refused output directory.
        path: PathBuf,
        /// Sorted relative entries; presentation bounds the list.
        entries: Vec<String>,
    },
    /// Another writer or abandoned transaction owns this destination.
    #[error(
        "[mokly-static] Output is reserved at {}. Confirm no writer is active and inspect its backup before recovery.", .path.display()
    )]
    Reserved {
        /// Exact reservation.
        path: PathBuf,
    },
    /// The originally accepted output or its alias changed.
    #[error(
        "[mokly-static] Output changed during the build: {}. Retry after checking the directory.", .path.display()
    )]
    Replaced {
        /// Pinned output.
        path: PathBuf,
    },
    /// Input capture changed before installation.
    #[error("[mokly-static] Inputs changed during the build: {}. Build again.", .path.display())]
    InputsChanged {
        /// Changed input.
        path: PathBuf,
    },
    /// Cancellation before the installation commit point.
    #[error("[mokly-static] build cancelled")]
    Cancelled,
    /// Portable path grammar failed before inventory insertion.
    #[error(
        "[mokly-static] The output path {} is not portable. Rename that file or folder, then build again.", quoted(.path)
    )]
    Portable {
        /// Invalid relative output path.
        path: String,
    },
    /// Exact, case, or prefix collision in the complete output inventory.
    #[error("[mokly-static] Output paths collide: {path} and {other}.")]
    Collision {
        /// New path.
        path: String,
        /// Existing path.
        other: String,
    },
    /// A regular file exceeds its specified ceiling.
    #[error("[mokly-static] Output file exceeds 64 MiB: {path}.")]
    TooLarge {
        /// Rejected file.
        path: String,
    },
    /// Recovery failed; both causes remain available for inspection.
    #[error(
        "[mokly-static] {primary}\nRecovery failed: {cleanup}\nInspect retained recovery path {}.", .path.display()
    )]
    Recovery {
        /// Original failure.
        #[source]
        primary: Box<Error>,
        /// Cleanup or restore failure.
        cleanup: Box<Error>,
        /// Retained reservation or backup.
        path: PathBuf,
    },
    /// Installation succeeded but old files or reservation remain.
    #[error(
        "[mokly-static] The new site is installed. Cleanup failed: {source}\nInspect remaining recovery path {}.", .path.display()
    )]
    Installed {
        /// Cleanup failure.
        source: Box<Error>,
        /// Retained path, possibly a partial backup.
        path: PathBuf,
    },
    /// No rendered entries can form a catalogue.
    #[error("[mokly-static] The catalogue is empty.")]
    Empty,
    /// Required package or generated output is absent or malformed.
    #[error("[mokly-static] Invalid static output at {path}.")]
    Invalid {
        /// Offending file or route.
        path: String,
    },
    /// Inspector publication failed for a specific current document.
    #[error("[mokly-static] {route}: {reason}")]
    Inspector {
        /// Generated document route.
        route: String,
        /// Typed metadata failure.
        reason: InspectorFailure,
    },
    /// A document plan refers to an absent catalogue entry.
    #[error("[mokly-static] Invalid document plan for {route}: entry {entry} is absent.")]
    PlanEntry {
        /// Planned route.
        route: String,
        /// Invalid entry index.
        entry: usize,
    },
    /// A package script cannot be parsed as a module.
    #[error("[mokly-static] Could not read module references: {path}:{line}:{column}.")]
    ModuleSyntax {
        /// Script path.
        path: String,
        /// One-based parser line.
        line: usize,
        /// One-based parser column.
        column: usize,
    },
    /// A package module request does not resolve to an inventoried file.
    #[error("[mokly-static] Module resource is unavailable: {path} -> {request}.")]
    ModuleReference {
        /// Importing script.
        path: String,
        /// Decoded request.
        request: String,
    },
    /// A graph render failed without losing its diagnostic records.
    #[error("[mokly-static] {source}")]
    Render {
        /// Original render failure.
        source: Box<GraphError>,
    },
    /// Unexpected adapter failure keeps its typed cause.
    #[error("[mokly-static] {0}")]
    Internal(#[from] InternalError),
}

/// Adapter causes retained for diagnostics.
#[derive(Debug, Error)]
pub enum InternalError {
    /// Filesystem operation failed.
    #[error("{operation} failed at {}: {source}", .path.display())]
    Io {
        /// Operation name.
        operation: &'static str,
        /// Exact path.
        path: PathBuf,
        /// OS cause.
        source: io::Error,
    },
    /// Platform no-replace rename failed.
    #[error("exclusive rename failed: {source}")]
    Rename {
        /// OS primitive cause.
        source: mokly_platform::error::Error,
    },
    /// Shared format validation failed.
    #[error("output format failed: {source}")]
    Format {
        /// Shared format cause.
        source: FormatError,
    },
    /// JSON encoding failed.
    #[error("JSON encoding failed: {source}")]
    Json {
        /// Serialization cause.
        source: serde_json::Error,
    },
    /// Canonical projection failed.
    #[error("catalogue projection failed: {source}")]
    Model {
        /// Shared model cause.
        source: mokly_model::error::ModelError,
    },
    /// Source policy compilation failed.
    #[error("source policy failed: {source}")]
    Catalogue {
        /// Typed configuration cause.
        source: Box<mokly_catalogue::error::CatalogueError>,
    },
    /// Source access failed.
    #[error("source capture failed: {source}")]
    Source {
        /// Confined source failure.
        source: mokly_source_interface::error::SourceError,
    },
}

pub(crate) trait IoResult<T> {
    fn at(self, operation: &'static str, path: &Path) -> Result<T>;
}
impl<T> IoResult<T> for io::Result<T> {
    #[track_caller]
    fn at(self, operation: &'static str, path: &Path) -> Result<T> {
        match self {
            Ok(value) => Ok(value),
            Err(source) => Err(InternalError::Io {
                operation,
                path: path.into(),
                source,
            }
            .into()),
        }
    }
}

fn quoted(value: &str) -> String {
    let mut output = String::from("\"");
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            '\u{8}' => output.push_str("\\b"),
            '\u{c}' => output.push_str("\\f"),
            value if value.is_control() => output.push_str(&format!("\\u{:04x}", u32::from(value))),
            value => output.push(value),
        }
    }
    output.push('"');
    output
}
