//! Public logical instance, slot, and region usage records.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::wire_props::ComponentWireProps;

/// Input ownership, scoped to one view.
#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum ComponentInputOwner {
    /// The entry owns these inputs.
    Entry,
    /// A containing instance owns these inputs.
    Instance {
        /// Parent instance key.
        #[serde(rename = "instanceKey")]
        instance_key: String,
    },
}
/// Region inspection target.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
pub enum ComponentRangeTarget {
    /// Logical component instance.
    Instance {
        /// Instance key in this view.
        #[serde(rename = "instanceKey")]
        instance_key: String,
    },
    /// Supplied slot placement.
    Slot {
        /// Slot key in this view.
        #[serde(rename = "slotKey")]
        slot_key: String,
    },
    /// Component own-page root boundary.
    Root,
}

/// Optional invocation source metadata.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComponentSourceLocation {
    /// Repository-relative invocation path.
    pub path: String,
    /// Positive one-based line.
    pub line: u64,
    /// Positive one-based column.
    pub column: u64,
}

/// One logical use, independent of physical placement.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComponentInstanceRecord {
    /// Validated instance identity digest.
    pub key: String,
    /// Effective local instance id.
    pub id: String,
    /// Registered parent component path.
    pub component_id: String,
    /// Input owner in this view.
    pub owner: ComponentInputOwner,
    /// Original receiving slot scope.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub slot_key: Option<String>,
    /// Zero-based input encounter order within its scope.
    pub order: u64,
    /// Validated complete data props.
    pub props: ComponentWireProps,
    /// Digest of normalized props.
    pub props_key: String,
    /// Optional authored invocation source.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub source: Option<ComponentSourceLocation>,
}

/// One supplied logical slot, including unrendered slots.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComponentSlotRecord {
    /// Validated slot identity digest.
    pub key: String,
    /// Receiving instance key.
    pub instance_key: String,
    /// Declared slot name.
    pub name: String,
    /// Supplier input owner.
    pub owner: ComponentInputOwner,
    /// Earlier forwarding slot key.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub source_slot_key: Option<String>,
}

/// One physical region in tree start order.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComponentRangeRecord {
    /// Sequential r-n region id.
    pub id: String,
    /// Logical record or root boundary.
    pub target: ComponentRangeTarget,
    /// Nearest enclosing region id.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_id: Option<String>,
}

/// Per-view usage readiness. Empty ready arrays mean proven empty usage.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "status", rename_all = "lowercase", deny_unknown_fields)]
pub enum CatalogueUsage {
    /// First render has not completed.
    Pending,
    /// Historical usage is unavailable.
    Unavailable,
    /// Validated composed usage.
    Ready {
        /// Instances in key order.
        instances: Vec<ComponentInstanceRecord>,
        /// Slots in key order.
        slots: Vec<ComponentSlotRecord>,
        /// Regions in tree order.
        ranges: Vec<ComponentRangeRecord>,
    },
}
