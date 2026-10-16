//! Private JavaScript recipes retained after catalogue identity resolution.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Debug;
use std::sync::Arc;

use mokly_model::prop_schema::Primitive;
use serde_json::Number;

use crate::diagnostic::Issue;

/// Keeps a provider generation alive while catalogue or graph users retain it.
pub trait GenerationLease: Debug + Send + Sync {}

/// One immutable bundle, evaluated only after the core installs CSS Modules.
#[derive(Clone, Debug, Default)]
pub struct JavaScriptGeneration {
    /// Provider-owned lifetime, released after the final graph or request.
    pub lease: Option<Arc<dyn GenerationLease>>,
    /// Side-specific bundle identity.
    pub id: String,
    /// Digest of the complete CSS Modules table.
    pub class_maps_digest: String,
    /// Consumer stylesheet context retained for the graph preparation.
    pub css_context: String,
    /// Resolution metadata and missing candidates that must remain observable.
    pub resolution_files: BTreeSet<String>,
    /// Consumed-module directories whose file membership can change resolution.
    pub resolution_directories: BTreeMap<String, BTreeSet<String>>,
    /// Logical module paths and ordered imports, including dependencies.
    pub modules: BTreeMap<String, Vec<String>>,
}

/// A JavaScript definition's rendering operation.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum RenderMethod {
    /// React screen.
    #[default]
    Screen,
    /// Registered React component.
    Component,
    /// Storybook parent or saved story.
    Story,
    /// Complete authored document.
    Page,
}

/// One entry's resolved callback and saved React slots.
#[derive(Clone, Debug, Default)]
pub struct RenderSource {
    /// Exporting module and export, independent of source attribution.
    pub handle: String,
    /// Callback operation.
    pub method: RenderMethod,
    /// Slot name to opaque generation-owned React value.
    pub slots: BTreeMap<String, String>,
    /// Config-relative public component CSS declarations.
    pub stylesheets: Vec<String>,
}

/// JavaScript metadata stays private and never enters the read model.
#[derive(Clone, Debug, Default)]
pub struct JavaScriptCatalogue {
    /// Complete resolved handle table, including non-rendered definitions.
    pub bindings: BTreeMap<String, ResolvedDefinition>,
    /// Loaded generation, absent for an HTML-only catalogue.
    pub generation: Option<JavaScriptGeneration>,
    /// Effective parent and variant paths to their rendering recipes.
    pub entries: BTreeMap<String, RenderSource>,
}

/// Storybook annotations enrich controls without changing schema validation.
#[derive(Clone, Debug, Default)]
pub struct StoryControlHint {
    /// Primitive select choices.
    pub options: Option<Vec<Primitive>>,
    /// Optional control bounds.
    pub minimum: Option<Number>,
    /// Optional control bound.
    pub maximum: Option<Number>,
    /// Optional positive step.
    pub step: Option<Number>,
    /// Display label.
    pub label: Option<String>,
    /// Help text.
    pub description: Option<String>,
}

/// Non-data inference diagnostic before its final path exists.
#[derive(Clone, Debug)]
pub struct ExcludedProp {
    /// Saved variant slug, absent for the parent's own props.
    pub variant: Option<String>,
    /// Excluded top-level key.
    pub key: String,
}

/// A path reference or an imported definition handle.
#[derive(Clone, Debug)]
pub enum EntryReference {
    /// Authored complete or relative path.
    Path(String),
    /// Handle resolved after all definitions have their final paths.
    Handle(String),
}

/// Provider-only metadata for one exported definition.
#[derive(Clone, Debug, Default)]
pub struct ProvidedRendering {
    /// Source diagnostics retained with invalid but identifiable definitions.
    pub issues: Vec<DefinitionIssue>,
    /// Rendering recipes keyed by slug; the empty key selects the parent.
    pub entries: BTreeMap<String, RenderSource>,
    /// Per-entry Storybook hints, keyed by slug.
    pub story_hints: BTreeMap<String, BTreeMap<String, StoryControlHint>>,
    /// Excluded data keys awaiting identity resolution.
    pub excluded_props: Vec<ExcludedProp>,
    /// Parent and variant flow memberships keyed by slug.
    pub use_cases: BTreeMap<String, Vec<EntryReference>>,
    /// Imported screen references in step order.
    pub steps: Vec<EntryReference>,
}

/// A definition diagnostic whose optional variant path awaits parent derivation.
#[derive(Clone, Debug)]
pub struct DefinitionIssue {
    /// Saved variant slug, when known.
    pub variant: Option<String>,
    /// Original typed authoring issue.
    pub issue: Issue,
}

/// Resolved public identity for a described definition handle.
#[derive(Clone, Debug)]
pub struct ResolvedDefinition {
    /// Complete entry or folder path.
    pub path: String,
    /// Effective title.
    pub title: String,
}
