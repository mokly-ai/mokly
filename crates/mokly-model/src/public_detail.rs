//! Entry detail v3 and live descriptor v3 public contracts.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, EntryKind, Viewport};
use crate::evidence::ViewEvidence;
use crate::public_metadata::CatalogueIdentity;
use crate::review::{EntryChangeReason, ReviewEntryAddress, ReviewState};
use crate::usage::CatalogueUsage;
use crate::wire_props::ComponentWireProps;

/// Entry identity repeated by its detail.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DetailEntry {
    /// Complete entry path.
    pub path: String,
    /// Entry kind.
    pub kind: EntryKind,
    /// Required on a removed entry detail.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub snapshot_id: Option<String>,
}

/// One view's usage and public comparison evidence.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DetailView {
    /// Viewport axis.
    pub viewport: Viewport,
    /// Color scheme axis.
    pub color_scheme: ColorScheme,
    /// Usage readiness, never absent.
    pub usage: CatalogueUsage,
    /// Review state of the view, present exactly with `resource_evidence`.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub state: Option<ReviewState>,
    /// Paired ignore ids, sorted and unique, present exactly with `resource_evidence`.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ignored_ids: Option<Vec<String>>,
    /// Present exactly when comparison evidence is ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub resource_evidence: Option<ViewEvidence>,
}

/// One current or affected component use.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UsageLink {
    /// Consuming screen or component entry path.
    pub entry_path: String,
    /// Consuming kind.
    pub entry_kind: VisualKind,
    /// Consuming entry title.
    pub title: String,
    /// Viewport axis.
    pub viewport: Viewport,
    /// Scheme axis.
    pub color_scheme: ColorScheme,
    /// Scoped instance key.
    pub instance_key: String,
    /// Whether the use is direct.
    pub direct: bool,
    /// Whether this is a historical use.
    pub removed: bool,
    /// Whether the use can be compared.
    pub comparison_eligible: bool,
}

/// Kinds with component usage and viewport views.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum VisualKind {
    /// Screen entry.
    Screen,
    /// Component entry.
    Component,
}

/// One instance whose complete props differ.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InputChange {
    /// Effective instance id.
    pub instance_id: String,
    /// Component title.
    pub title: String,
    /// Viewport axis.
    pub viewport: Viewport,
    /// Scheme axis.
    pub color_scheme: ColorScheme,
    /// Variant entry context, when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variant_path: Option<String>,
    /// Base complete props.
    pub before: ComponentWireProps,
    /// Current complete props.
    pub after: ComponentWireProps,
}

/// Comparison and component workspace lists.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    /// Whether this entry has an eligible comparison.
    pub comparison_eligible: bool,
    /// Current consuming uses.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub used_by: Option<Vec<UsageLink>>,
    /// Affected consumers.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub affected: Option<Vec<UsageLink>>,
    /// Changed components affecting this entry.
    pub related_components: Vec<RelatedComponent>,
    /// Instances with changed data props.
    pub input_changes: Vec<InputChange>,
}

/// Changed component reference.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelatedComponent {
    /// Current component path.
    pub path: String,
    /// Component title.
    pub title: String,
}

/// One public entry detail, current or historical.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EntryDetailV3 {
    /// Must equal 3; readers gate it first.
    #[ts(type = "3")]
    pub schema_version: u32,
    /// Catalogue identity equal to the installed index.
    pub identity: CatalogueIdentity,
    /// Content id of this detail.
    pub detail_id: String,
    /// Current entries only, equal to the index.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub revision: Option<u64>,
    /// Entry identity and optional historical snapshot.
    pub entry: DetailEntry,
    /// Direct reasons in the review v8 shape, present for ready included entries of every kind.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reasons: Option<Vec<EntryChangeReason>>,
    /// Base side address of a ready current screen or component that has one.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub before: Option<ReviewEntryAddress>,
    /// Empty for pages, documents, and use cases.
    pub views: Vec<DetailView>,
    /// Every editable key in declaration order; present only on screens and components.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub control_order: Option<Vec<String>>,
    /// Page evidence, present when ready.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub resource_evidence: Option<ViewEvidence>,
    /// Screen and component workspace lists.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub workspace: Option<Workspace>,
}

/// Private local-Serve render capability.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenderCapability {
    /// Exactly /mokly-viewer/components/render.
    #[ts(type = "`/${typeof VIEWER_DIRECTORY}/components/render`")]
    pub url: String,
    /// Opaque secret render token.
    pub token: String,
}

/// Serve render capability fenced by generation.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LiveDescriptorV3 {
    /// Must equal 3; readers gate it first.
    #[ts(type = "3")]
    pub schema_version: u32,
    /// Equal to the installed index live generation.
    pub generation: String,
    /// Private render capability.
    pub render: RenderCapability,
}
