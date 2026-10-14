//! Definition inventories returned by describe; catalogue projection is separate.

use std::collections::BTreeMap;

use mokly_model::prop_schema::PropSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A saved props set on an exported screen or component.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    /// Authored path segment.
    pub slug: String,
    /// Display title.
    pub title: String,
    /// Top-level props replacements.
    pub props: BTreeMap<String, Value>,
    /// Description override.
    pub description: Option<String>,
    /// Ordered tags override.
    pub tags: Option<Vec<String>>,
    /// Additional declarative authoring metadata consumed by the catalogue.
    #[serde(flatten)]
    pub metadata: BTreeMap<String, Value>,
}

/// An exported definition, before the core derives catalogue identity.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Definition {
    /// Repository-relative module path and export name.
    pub handle: String,
    /// Optional authored slug.
    pub slug: Option<String>,
    /// Optional authored title.
    pub title: Option<String>,
    /// Optional help text.
    pub description: Option<String>,
    /// Schema supplied by the definition, required for components.
    pub prop_schema: Option<PropSchema>,
    /// Entry's own data props.
    #[serde(default)]
    pub props: BTreeMap<String, Value>,
    /// Saved variants in authored order.
    #[serde(default)]
    pub variants: Vec<Variant>,
    /// Declared React slots.
    #[serde(default)]
    pub slots: Vec<String>,
    /// Optional HTML custom element name.
    pub element: Option<String>,
    /// Ordered authored tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Remaining authoring metadata is preserved at this JSON boundary.
    #[serde(flatten)]
    pub metadata: BTreeMap<String, Value>,
}

/// Story inventory entry; each story becomes a component variant.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Story {
    /// File and export name.
    pub id: String,
    /// Display title.
    pub title: String,
    /// Serializable args, excluding action and function args.
    pub props: BTreeMap<String, Value>,
    /// Story control hints and other declarative annotations.
    #[serde(flatten)]
    pub metadata: BTreeMap<String, Value>,
}

/// Every definition exported by one bundle generation.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Definitions {
    /// React screens.
    pub screens: Vec<Definition>,
    /// Synchronous pages.
    pub pages: Vec<Definition>,
    /// Use-case records.
    pub use_cases: Vec<Definition>,
    /// Folder records.
    pub folders: Vec<Definition>,
    /// Registered components.
    pub components: Vec<Definition>,
    /// Composed stories.
    pub stories: Vec<Story>,
}
