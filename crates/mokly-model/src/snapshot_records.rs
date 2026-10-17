//! Historical private entry records carried by change snapshot v4.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, EntryKind};
use crate::controls::ComponentControl;
use crate::prop_schema::PropSchema;
use crate::wire_props::ComponentWireProps;

/// Common historical authoring metadata. It grants no source-read permission.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecordMetadata {
    /// Complete historical identity.
    pub path: String,
    /// Historical title.
    pub title: String,
    /// Historical description.
    pub description: String,
    /// Historical rationale.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rationale: Option<String>,
    /// Authored earlier path, not an inferred move.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub moved_from: Option<String>,
    /// Historical document links or labels.
    pub related_docs: Vec<String>,
    /// Historical source file.
    pub source_path: String,
    /// Historical tags in authored order.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tags: Option<Vec<String>>,
}

/// Shared screen and component data without rendered views.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecordVisual {
    /// Historical parent, on variants only.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant_of: Option<String>,
    /// Available schemes, light first.
    pub color_schemes: Vec<ColorScheme>,
    /// Side's validated schema.
    pub prop_schema: PropSchema,
    /// Complete tagged props.
    pub props: ComponentWireProps,
    /// Derived or authored controls.
    pub controls: BTreeMap<String, ComponentControl>,
}

/// Historical records with the flat fields of the entry-record contract.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum EntryRecord {
    /// Screen or screen variant.
    Screen {
        /// Common metadata.
        #[serde(flatten)]
        metadata: RecordMetadata,
        /// Props and schemes.
        #[serde(flatten)]
        visual: RecordVisual,
        /// Address-bar label.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        address: Option<String>,
        /// Reciprocal historical journey membership.
        #[serde(rename = "useCasePaths")]
        use_case_paths: Vec<String>,
    },
    /// Registered component or variant.
    Component {
        /// Common metadata.
        #[serde(flatten)]
        metadata: RecordMetadata,
        /// Props and schemes.
        #[serde(flatten)]
        visual: RecordVisual,
        /// HTML registry name when present.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        element: Option<String>,
        /// Declared slots.
        slots: Vec<String>,
        /// Historical supplied slots.
        #[serde(rename = "suppliedSlots")]
        supplied_slots: Vec<String>,
    },
    /// Authored complete document.
    Page {
        /// Common metadata.
        #[serde(flatten)]
        metadata: RecordMetadata,
    },
    /// Markdown document.
    Document {
        /// Common metadata.
        #[serde(flatten)]
        metadata: RecordMetadata,
        /// Historical schemes.
        #[serde(rename = "colorSchemes")]
        color_schemes: Vec<ColorScheme>,
        /// Historical referenced repository files.
        resources: Vec<String>,
    },
}

impl EntryRecord {
    /// Historical entry kind without consulting current paths.
    pub fn kind(&self) -> EntryKind {
        match self {
            Self::Screen { .. } => EntryKind::Screen,
            Self::Component { .. } => EntryKind::Component,
            Self::Page { .. } => EntryKind::Page,
            Self::Document { .. } => EntryKind::Document,
        }
    }

    /// Read common fields without losing the kind discriminant.
    pub fn metadata(&self) -> &RecordMetadata {
        match self {
            Self::Screen { metadata, .. }
            | Self::Component { metadata, .. }
            | Self::Page { metadata }
            | Self::Document { metadata, .. } => metadata,
        }
    }
}
