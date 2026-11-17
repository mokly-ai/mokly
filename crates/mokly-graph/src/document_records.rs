//! Private annotation records isolate the binary payload from public JSON rules.

use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::ComponentInputOwner;
use serde::{Deserialize, Serialize};

/// Source coordinates always encode their optional export field.
#[derive(Deserialize, Serialize)]
pub(crate) struct SourceRecord {
    path: String,
    line: usize,
    column: usize,
    export: Option<String>,
}

impl From<&SourceLocation> for SourceRecord {
    fn from(value: &SourceLocation) -> Self {
        Self {
            path: value.path.clone(),
            line: value.line,
            column: value.column,
            export: value.export.clone(),
        }
    }
}

impl From<SourceRecord> for SourceLocation {
    fn from(value: SourceRecord) -> Self {
        Self {
            path: value.path,
            line: value.line,
            column: value.column,
            export: value.export,
        }
    }
}

/// Slot input ownership does not use the public internally tagged JSON decoder.
#[derive(Deserialize, Serialize)]
pub(crate) enum OwnerRecord {
    /// The entry supplies these inputs.
    Entry,
    /// A containing instance supplies these inputs.
    Instance {
        /// Parent instance identity within the view.
        instance_key: String,
    },
}

impl From<&ComponentInputOwner> for OwnerRecord {
    fn from(value: &ComponentInputOwner) -> Self {
        match value {
            ComponentInputOwner::Entry => Self::Entry,
            ComponentInputOwner::Instance { instance_key } => Self::Instance {
                instance_key: instance_key.clone(),
            },
        }
    }
}

impl From<OwnerRecord> for ComponentInputOwner {
    fn from(value: OwnerRecord) -> Self {
        match value {
            OwnerRecord::Entry => Self::Entry,
            OwnerRecord::Instance { instance_key } => Self::Instance { instance_key },
        }
    }
}
