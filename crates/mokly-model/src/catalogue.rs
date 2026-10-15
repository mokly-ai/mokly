//! In-memory catalogue. Public projection is an explicit separate boundary.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, EntryKind};
use crate::controls::ComponentControl;
use crate::data::Props;
use crate::prop_schema::PropSchema;

/// One-based authored source location.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceLocation {
    /// Repository-relative POSIX source path.
    pub path: String,
    /// One-based line.
    pub line: usize,
    /// One-based column.
    pub column: usize,
    /// Export name for a JavaScript definition.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub export: Option<String>,
}

/// Resolved common entry identity and authored metadata.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EntryMetadata {
    /// Unique complete path.
    pub path: String,
    /// Nonempty authored or inferred title.
    pub title: String,
    /// Description, including an explicit empty string.
    pub description: String,
    /// Unique authored tags, in authored order.
    pub tags: Vec<String>,
    /// Optional design rationale.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rationale: Option<String>,
    /// Authored repository document labels.
    pub related_docs: Vec<String>,
    /// Validated prior complete path.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub moved_from: Option<String>,
    /// Private source coordinate of the authored move hint.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub moved_from_source: Option<SourceLocation>,
    /// Parent path, exactly on a variant.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant_of: Option<String>,
    /// Whether this entry is its folder's own page.
    pub is_index: bool,
    /// Private source attribution.
    pub source: SourceLocation,
    /// Root which owns the exporting source.
    pub root_index: usize,
}

/// Validated props and shared visual metadata.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VisualEntry {
    /// Effective schemes, light first.
    pub color_schemes: Vec<ColorScheme>,
    /// Validated declared or inferred schema.
    pub prop_schema: PropSchema,
    /// Own props or merged variant props.
    pub props: Props,
    /// Controls derived or declared for editing.
    pub controls: BTreeMap<String, ComponentControl>,
}

/// One ordered screen reference.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UseCaseStep {
    /// Resolved current screen path.
    pub screen_path: String,
    /// Optional step title.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
    /// Optional step description.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
}

/// Kind-specific catalogue content. Rendered documents and callbacks are not model fields.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum EntryContent {
    /// Screen metadata and its prop model.
    Screen {
        /// Shared visual props.
        visual: VisualEntry,
        /// Address-bar label.
        address: Option<String>,
        /// Reciprocal use-case membership.
        #[serde(rename = "useCasePaths")]
        use_case_paths: Vec<String>,
    },
    /// Registered component and its prop model.
    Component {
        /// Shared visual props.
        visual: VisualEntry,
        /// Custom element registration, when supplied.
        element: Option<String>,
        /// Declared slot names.
        slots: Vec<String>,
        /// Supplied slot names on a variant, empty on a parent.
        #[serde(rename = "suppliedSlots")]
        supplied_slots: Vec<String>,
    },
    /// Authored complete page.
    Page,
    /// Markdown document.
    Document {
        /// Effective document schemes.
        #[serde(rename = "colorSchemes")]
        color_schemes: Vec<ColorScheme>,
        /// Sorted unique repository resource paths, filled by composition.
        resources: Vec<String>,
    },
    /// Ordered journey through screens.
    UseCase {
        /// Ordered steps.
        steps: Vec<UseCaseStep>,
    },
}

impl EntryContent {
    /// Entry kind independent of payload details.
    pub fn kind(&self) -> EntryKind {
        match self {
            Self::Screen { .. } => EntryKind::Screen,
            Self::Component { .. } => EntryKind::Component,
            Self::Page => EntryKind::Page,
            Self::Document { .. } => EntryKind::Document,
            Self::UseCase { .. } => EntryKind::UseCase,
        }
    }
}

/// One current entry, including a flattened variant.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelEntry {
    /// Common identity and metadata.
    pub metadata: EntryMetadata,
    /// Validated kind-specific fields.
    pub content: EntryContent,
}

/// Validated presentation metadata. Exclusions stay outside the public model.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FolderRecord {
    /// Folder path, empty for the top level.
    pub path: String,
    /// Authored folder title.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
    /// Ordered child slugs with an optional rest marker.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub order: Option<Vec<String>>,
    /// Whether All and search hide this subtree.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hidden: Option<bool>,
    /// Private record attribution.
    pub source: SourceLocation,
}

/// Complete private catalogue state, never written as a file.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueModel {
    /// Kind and path order, with variants after each parent in authored order.
    pub entries: Vec<ModelEntry>,
    /// Validated records sorted by path.
    pub folders: Vec<FolderRecord>,
    /// Sorted unique repository-relative protected source inventory.
    pub sources: Vec<String>,
    /// Configured color schemes, light first.
    pub color_schemes: Vec<ColorScheme>,
}
