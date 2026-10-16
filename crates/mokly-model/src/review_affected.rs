//! Explicit side-bearing caller-ownership proof for affected consumers.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::axes::{ColorScheme, Viewport};
use crate::review::ReviewEntryAddress;

/// Side of the original composed tree.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ReviewSide {
    /// Base commit.
    Before,
    /// Working tree.
    After,
}

/// Entries which can consume component instances.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ConsumerKind {
    /// Component or component variant view.
    Component,
    /// Screen or screen variant view.
    Screen,
}

/// Original entry and view in which a usage was composed.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComponentUsageContext {
    /// Kind of the context entry.
    pub kind: ConsumerKind,
    /// Original side's entry address.
    pub entry: ReviewEntryAddress,
    /// Viewport axis.
    pub viewport: Viewport,
    /// Appearance axis.
    pub color_scheme: ColorScheme,
}

/// One ownership edge in an actual composed view.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AffectedInstance {
    /// Original side's registered component path.
    pub component_id: String,
    /// Logical scoped instance key.
    pub instance_key: String,
}

/// One nonempty chain from a consumer to an impacted component.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AffectedUsageEvidence {
    /// Side of the proof.
    pub side: ReviewSide,
    /// Original consuming entry and view.
    pub context: ComponentUsageContext,
    /// Ordered ownership path, never physical placement ancestry.
    pub via: Vec<AffectedInstance>,
}

/// Canonical identity of one affected entry.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct AffectedConsumerAddress {
    /// Consumer kind.
    pub kind: ConsumerKind,
    /// Accepted current path, or historical path when removed.
    pub path: String,
}

/// One changed component and canonical consumer with complete usage proof.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AffectedConsumer {
    /// Component identity with included parent or variant implementation impact.
    pub changed_component_id: String,
    /// Canonical consuming entry.
    pub consumer: AffectedConsumerAddress,
    /// Sorted unique usage evidence from both sides.
    pub evidence: Vec<AffectedUsageEvidence>,
}
