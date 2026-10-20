//! Definition inventories returned by describe; catalogue projection is separate.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::controls::{Control, StoryHints};
use crate::definition_metadata::{EntryMetadata, EntryReference, UseCaseStep};
use crate::diagnostics::DefinitionDiagnostic;
use crate::methods::ColorScheme;
use crate::results::Warning;

/// A saved props set with typed metadata overrides.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Variant {
    /// Non-data inference exclusions, before catalogue path derivation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub excluded_props: Option<Vec<String>>,
    /// Authored final path segment.
    pub slug: String,
    /// Display title.
    pub title: String,
    /// Top-level data prop replacements.
    pub props: BTreeMap<String, Value>,
    /// Description override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    /// Ordered tag override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub tags: Option<Vec<String>>,
    /// Previous path override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub moved_from: Option<String>,
    /// Effective colour scheme override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub color_schemes: Option<Vec<ColorScheme>>,
    /// Address-bar label override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub address: Option<String>,
    /// Rationale override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rationale: Option<String>,
    /// Related document override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub related_docs: Option<Vec<String>>,
    /// Flow membership override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub use_case_paths: Option<Vec<EntryReference>>,
    /// Saved React slot handles retained in the Node generation.
    #[serde(default)]
    pub slots: BTreeMap<String, String>,
}

/// An exported definition with all declarative fields represented explicitly.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Definition {
    /// Non-data inference exclusions, before catalogue path derivation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub excluded_props: Option<Vec<String>>,
    /// Repository-relative module and export name.
    pub handle: String,
    /// Module that created the definition; it can differ from the exporting module.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub source_path: Option<String>,
    /// Shared entry metadata.
    #[serde(flatten)]
    pub metadata: EntryMetadata,
    /// Authored schema JSON; only the core's PropValidator interprets it.
    #[serde(
        default,
        deserialize_with = "schema_value",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub prop_schema: Option<Value>,
    /// Entry's own data props.
    #[serde(default)]
    pub props: BTreeMap<String, Value>,
    /// Saved variants in authored order.
    #[serde(default)]
    pub variants: Vec<Variant>,
    /// Declared optional React slot names.
    #[serde(default)]
    pub slots: Vec<String>,
    /// Custom element name for HTML invocations.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub element: Option<String>,
    /// Explicit control overrides.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub controls: Option<BTreeMap<String, Control>>,
    /// Candidate control keys in authored order, before the core omits uneditable props.
    #[serde(default)]
    pub control_order: Vec<String>,
    /// Storybook meta hints for the component parent's own controls.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub arg_types: Option<BTreeMap<String, StoryHints>>,
    /// Effective colour schemes.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub color_schemes: Option<Vec<ColorScheme>>,
    /// Address-bar label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub address: Option<String>,
    /// Authored flow memberships.
    #[serde(default)]
    pub use_case_paths: Vec<EntryReference>,
    /// Public component stylesheet paths.
    #[serde(default)]
    pub stylesheets: Vec<String>,
    /// Ordered use-case steps.
    #[serde(default)]
    pub steps: Vec<UseCaseStep>,
    /// Ordered folder child slugs.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub order: Option<Vec<String>>,
    /// Folder visibility.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub hidden: Option<bool>,
}

/// Story inventory after non-data args have been excluded.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Story {
    /// File and export name.
    pub id: String,
    /// Display title.
    pub title: String,
    /// Serializable merged args.
    pub props: BTreeMap<String, Value>,
    /// Schema-independent control hints by arg name.
    #[serde(default)]
    pub arg_types: BTreeMap<String, StoryHints>,
}

/// Every definition and every source diagnostic of a bundle generation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
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
    /// Source-attributed authoring diagnostics; these do not invalidate framing.
    #[serde(default)]
    pub diagnostics: Vec<DefinitionDiagnostic>,
    /// Generation diagnostics from excluded non-data props.
    pub warnings: Vec<Warning>,
}

fn schema_value<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<Value>, D::Error> {
    Ok(Some(Value::deserialize(deserializer)?))
}
