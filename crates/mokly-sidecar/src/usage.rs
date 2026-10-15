//! Render drafts that the core validates before building view usage records.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Tagged plain data; numeric spellings preserve negative zero.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
#[ts(untagged)]
pub enum WireValue {
    /// Null value.
    Null((NullTag,)),
    /// String value.
    String((StringTag, String)),
    /// Boolean value.
    Boolean((BooleanTag, bool)),
    /// Finite decimal spelling.
    Number((NumberTag, String)),
    /// Dense array.
    Array((ArrayTag, Vec<WireValue>)),
    /// UTF-16-sorted key and value pairs.
    Object((ObjectTag, Vec<(String, WireValue)>)),
}

macro_rules! tag {
    ($name:ident, $value:literal) => {
        #[doc = concat!("Canonical ", $value, " wire tag.")]
        #[derive(Clone, Debug, Deserialize, Serialize, TS)]
        pub enum $name {
            #[doc = concat!("The literal ", $value, ".")]
            #[serde(rename = $value)]
            Tag,
        }
    };
}
tag!(NullTag, "null");
tag!(StringTag, "string");
tag!(BooleanTag, "boolean");
tag!(NumberTag, "number");
tag!(ArrayTag, "array");
tag!(ObjectTag, "object");

/// Original input owner, independent of physical placement.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum InputOwner {
    /// Inputs belong to the rendered entry.
    Entry,
    /// Inputs belong to a registered instance.
    Instance {
        /// Parent logical instance key.
        #[serde(rename = "instanceKey")]
        instance_key: String,
    },
}

/// Optional JSX invocation location.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct InvocationSource {
    /// Repository-relative POSIX file path.
    pub path: String,
    /// One-based source line.
    pub line: u64,
    /// One-based source column.
    pub column: u64,
}

/// One rendered placement of a logical component instance.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstanceDraft {
    /// Fragment-local placement id, also present in the marker.
    pub region_id: String,
    /// Canonical logical instance key.
    pub key: String,
    /// Effective local instance id.
    pub id: String,
    /// Resolved registered component path.
    pub component_path: String,
    /// Original input owner.
    pub owner: InputOwner,
    /// Original receiving slot, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub slot_key: Option<String>,
    /// Zero-based encounter order in the input scope.
    pub order: u64,
    /// Canonical tagged data props.
    pub props: BTreeMap<String, WireValue>,
    /// Canonical props digest.
    pub props_key: String,
    /// Invocation source when the JSX development shim supplies it.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub source: Option<InvocationSource>,
}

/// One supplied slot, including slots that the adapter does not render.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SlotDraft {
    /// Canonical receiving slot key.
    pub key: String,
    /// Receiving logical instance key.
    pub instance_key: String,
    /// Declared slot name.
    pub name: String,
    /// Original input owner.
    pub owner: InputOwner,
    /// Earlier receiving slot when the value is forwarded.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub source_slot_key: Option<String>,
    /// Receiving instance placement id.
    pub instance_region_id: String,
    /// Slot placement ids in render order; empty when unused.
    pub region_ids: Vec<String>,
}
