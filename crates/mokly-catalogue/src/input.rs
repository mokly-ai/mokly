//! Typed entry definitions produced by Rust parsing or a future sidecar provider.

use std::collections::BTreeMap;

use mokly_model::axes::ColorScheme;
use mokly_model::catalogue::UseCaseStep;
use mokly_model::controls::ComponentControl;
use mokly_model::data::Props;
use serde::Deserialize;
use serde_json::Value;

use crate::diagnostic::Issue;
use crate::yaml::Document;

/// Common declarative definition before path derivation.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryInput {
    /// Required nonempty title.
    pub title: String,
    /// Description, default empty for file entries.
    #[serde(default)]
    pub description: String,
    /// Authored tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Explicit entry-module slug; file kinds do not accept this key.
    pub slug: Option<String>,
    /// Complete path override.
    pub path: Option<String>,
    /// Complete previous path.
    pub moved_from: Option<String>,
    /// Design rationale.
    pub rationale: Option<String>,
    /// Related repository documents.
    #[serde(default)]
    pub related_docs: Vec<String>,
    /// Effective color-scheme override.
    pub color_schemes: Option<Vec<ColorScheme>>,
    /// Screen address-bar label.
    pub address: Option<String>,
    /// Reciprocal use-case membership.
    #[serde(default)]
    pub use_case_paths: Vec<String>,
    /// Raw schema, interpreted once by the model validator.
    pub prop_schema: Option<Value>,
    /// Own complete prop values.
    #[serde(default)]
    pub props: Props,
    /// Raw variant records; shape checks precede parent-dependent validation.
    #[serde(default)]
    pub variants: Vec<Value>,
    /// Custom component element.
    pub element: Option<String>,
    /// Declared component slots.
    #[serde(default)]
    pub slots: Vec<String>,
    /// Ordered use-case steps.
    #[serde(default)]
    pub steps: Vec<UseCaseStep>,
    /// Explicit controls replace the schema-derived controls.
    pub controls: Option<BTreeMap<String, ComponentControl>>,
    /// Stories infer a component schema from their args.
    #[serde(skip)]
    pub infer_component_schema: bool,
}

/// One saved props and metadata override.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VariantInput {
    pub(crate) slug: String,
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) props: Props,
    pub(crate) description: Option<String>,
    pub(crate) tags: Option<Vec<String>>,
    pub(crate) moved_from: Option<String>,
    pub(crate) color_schemes: Option<Vec<ColorScheme>>,
    pub(crate) address: Option<String>,
    pub(crate) rationale: Option<String>,
    pub(crate) related_docs: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) use_case_paths: Vec<String>,
    #[serde(default)]
    pub(crate) slots: BTreeMap<String, String>,
}

/// A source's parsed body, metadata, and exact field locations.
#[derive(Clone, Debug)]
pub(crate) struct ParsedEntry {
    pub(crate) input: EntryInput,
    pub(crate) issues: Vec<Issue>,
    pub(crate) document: Document,
    pub(crate) body: String,
    pub(crate) body_offset: usize,
    pub(crate) text: String,
}
