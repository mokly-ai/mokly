//! Allowlisted public per-view rule and resource evidence.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Owner of rule or resource evidence; CSS is never a resource owner.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum EvidenceOwner {
    /// The containing entry.
    Entry,
    /// A registered component parent.
    Component {
        /// Component parent path.
        path: String,
    },
}
/// Selector match classification.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum RuleStatus {
    /// The rule matches a retained node.
    Matched,
    /// The rule matches no retained node.
    Excluded,
    /// Matching could not be proved.
    Unresolved,
}

/// One public selector attribution record.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RuleEvidence {
    /// Public stylesheet route, or containing document route for ownerless head rules.
    pub stylesheet: String,
    /// Selector, empty for an unmatched whole-sheet record.
    pub selector: String,
    /// Selector evidence classification.
    pub status: RuleStatus,
    /// Owner of the matched output.
    pub owner: EvidenceOwner,
}

/// One reached rendered resource.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResourceEvidence {
    /// Rendered resource route, never a private source path.
    pub path: String,
    /// Owner of the referencing element.
    pub owner: EvidenceOwner,
}

/// Ready evidence with required explicit arrays.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ViewEvidence {
    /// Rule evidence, empty when omitted by review.
    pub rules: Vec<RuleEvidence>,
    /// Resource evidence, empty when omitted by review.
    pub resources: Vec<ResourceEvidence>,
}
