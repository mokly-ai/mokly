//! Review result v8, shared by classification, static output, and the viewer.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, Viewport};
use crate::evidence::{ResourceEvidence, RuleEvidence};
use crate::review_affected::AffectedConsumer;
use crate::wire_props::ComponentWireProps;

/// A view's comparison state. Entry aggregation uses explicit precedence.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewState {
    /// Equal canonical material and no direct evidence.
    Unchanged,
    /// Material or dependency evidence differs.
    Changed,
    /// No base view or entry.
    Added,
    /// No current view or entry.
    Removed,
    /// Differences occur only inside paired ignored regions.
    IgnoredOnly,
}

impl ReviewState {
    /// Aggregate actual view states without deriving materiality from entry reasons.
    pub fn aggregate(states: impl Iterator<Item = Self>) -> Self {
        states
            .max_by_key(|state| match state {
                Self::Changed => 4,
                Self::Added => 3,
                Self::Removed => 2,
                Self::IgnoredOnly => 1,
                Self::Unchanged => 0,
            })
            .unwrap_or(Self::Unchanged)
    }
}

/// Kinds represented by visual review records.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewKind {
    /// Registered component or variant.
    Component,
    /// Screen or variant.
    Screen,
    /// Ordered screen journey.
    UseCase,
}

/// One side's original address and inputs.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewEntryAddress {
    /// Original side path and case.
    pub path: String,
    /// Original side title.
    pub title: String,
    /// Complete tagged props on screens and components.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub props: Option<ComponentWireProps>,
    /// Supplied slot names on components only.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub supplied_slots: Option<Vec<String>>,
}

/// One complete viewport and appearance comparison.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewView {
    /// Viewport axis.
    pub viewport: Viewport,
    /// Appearance axis.
    pub color_scheme: ColorScheme,
    /// Actual classification of this view.
    pub state: ReviewState,
    /// Paired ignore ids, sorted and unique.
    pub ignored_ids: Vec<String>,
    /// Kept or excluded stylesheet evidence, absent when empty.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(optional, as = "Option<Vec<RuleEvidence>>")]
    pub rules: Vec<RuleEvidence>,
    /// Changed reached resources, absent when empty.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(optional, as = "Option<Vec<ResourceEvidence>>")]
    pub resources: Vec<ResourceEvidence>,
}

/// Direct reasons. A pure move is included with no reason.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum EntryChangeReason {
    /// A new entry.
    Added,
    /// A historical entry.
    Removed,
    /// Reviewable metadata changed.
    Metadata,
    /// Canonical owned material changed.
    Material,
    /// Render difference proved only at an actual unchanged-input instance.
    Implementation,
    /// Caller-owned instance props changed.
    Inputs,
    /// Caller-owned instance identity or order changed.
    Structure,
    /// Changed rendered resource attributed to this entry.
    Dependency {
        /// Public resource or stylesheet route.
        path: String,
    },
    /// A directly changed screen in a use case's steps.
    Screen {
        /// Exact screen or variant path.
        #[serde(rename = "screenPath")]
        screen_path: String,
    },
}

/// A complete comparison for an entry, including entries outside Changes.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewEntry {
    /// Entry kind.
    pub kind: ReviewKind,
    /// Current address, or base address when removed.
    pub path: String,
    /// Current title, or base title when removed.
    pub title: String,
    /// Original base address.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub before: Option<ReviewEntryAddress>,
    /// Original current address.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub after: Option<ReviewEntryAddress>,
    /// Accepted move counterpart, absent for a case-only rename.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub previous_path: Option<String>,
    /// Aggregate state of its views.
    pub state: ReviewState,
    /// Direct Changes membership.
    pub included: bool,
    /// Sorted unique direct reasons.
    pub reasons: Vec<EntryChangeReason>,
    /// View union in mobile/light through desktop/dark order.
    pub views: Vec<ReviewView>,
    /// Current authored variants followed by base-only variants, parents only.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub variants: Option<Vec<ReviewEntry>>,
}

/// One comparison diagnostic in production order.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ReviewDiagnostic {
    /// Exact diagnostic text.
    pub message: String,
}

/// Catalogue-wide review with explicit direct and affected membership.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewResultV8 {
    /// Exactly 8, checked before other payload fields.
    #[ts(type = "8")]
    pub schema_version: u32,
    /// Pinned merge base.
    pub base_commit: String,
    /// Every screen, component, variant, and use case.
    pub entries: Vec<ReviewEntry>,
    /// Complete implementation-impact usage evidence.
    pub affected: Vec<AffectedConsumer>,
    /// Comparison diagnostics, including moves.
    pub diagnostics: Vec<ReviewDiagnostic>,
}
