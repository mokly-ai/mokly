//! Request payloads for every sidecar method.

use std::collections::BTreeMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::bindings::{Bindings, DisposeContext, EntryBinding, SlotInput};
pub use crate::bundle_params::Bundle;
use crate::capture_hint::CaptureHint;
use crate::compiled::RestoreGeneration;
use crate::postcss_preparation::{PostcssPreparation, PrepareContext};
use crate::resolution_plan::ResolutionPlan;
use crate::storybook::ReadStorybookParams;
use crate::vite_css::TransformViteCss;

pub mod source_packages;

use self::source_packages::SourcePackages;

/// A request with no method parameters.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[ts(rename = "EmptyParams")]
pub struct Empty {}

/// A loaded bundle generation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[ts(rename = "GenerationParams")]
pub struct Generation {
    /// Content-addressed generation id.
    pub generation: String,
}

/// Consumer module resolution settings; list order is meaningful.
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ModuleResolution {
    /// Selected installation repository for per-importer Node lookup.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub dependency_root: Option<String>,
    /// Module aliases.
    #[serde(default)]
    pub aliases: BTreeMap<String, String>,
    /// Ordered package conditions.
    #[serde(default)]
    pub conditions: Vec<String>,
    /// Consumer loader overrides.
    #[serde(default)]
    pub loaders: BTreeMap<String, String>,
    /// Ordered package entry fields.
    #[serde(default)]
    pub main_fields: Vec<String>,
    /// Consumer package roots.
    #[serde(default)]
    pub package_roots: Vec<String>,
    /// Ordered extension candidates.
    #[serde(default)]
    pub resolve_extensions: Vec<String>,
    /// Workspace source overrides in layout order.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[ts(optional, as = "Option<_>")]
    pub source_packages: Vec<SourcePackages>,
}

/// Request-local evidence capture policy, absent from persisted bundle settings.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum BundleCapture {
    /// Capture complete physical inputs and optional durability witnesses.
    #[default]
    Full,
    /// Keep only the existing live reuse inputs after Serve publishes its head.
    ServeEdit,
}

/// Compile settings and a request-only capture policy.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct BundleRequest {
    /// Persisted compilation settings, with no capture control.
    #[serde(flatten)]
    pub params: Bundle,
    /// Omission selects full capture.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub capture: Option<BundleCapture>,
    /// Current captured targets for this Serve edit only, never persisted settings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub plan: Option<Arc<ResolutionPlan>>,
    /// Fresh PostCSS context for this request's attempt, absent from bundle settings.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub preparation: Option<PostcssPreparation>,
}

/// Preview colour scheme.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ColorScheme {
    /// Light appearance.
    Light,
    /// Dark appearance.
    Dark,
}

/// Enclosing material-ignore scope at a component invocation.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum IgnoreScope {
    /// Ignore pairs inside this scope are active.
    Enabled,
    /// Ignore pairs inside this scope are suppressed.
    Disabled,
}

/// Render a screen by definition handle.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RenderParams")]
pub struct Render {
    /// Loaded bundle generation.
    pub generation: String,
    /// Repository-relative module and export name.
    pub handle: String,
    /// Effective rendered parent or variant.
    pub entry: EntryBinding,
    /// Validated JSON data props.
    pub props: BTreeMap<String, Value>,
    /// Viewport identifier.
    pub viewport: String,
    /// Effective colour scheme.
    pub color_scheme: ColorScheme,
}

/// Render a registered component with core-owned slot placeholders.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RenderComponentParams")]
pub struct RenderComponent {
    /// Shared render inputs.
    #[serde(flatten)]
    pub render: Render,
    /// Slot name to a placeholder or saved React value.
    pub slots: BTreeMap<String, SlotInput>,
    /// Enclosing ignore state.
    pub ignore_scope: IgnoreScope,
}

/// Render a composed Storybook story with exactly the requested data props.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RenderStoryParams")]
pub struct RenderStory {
    /// Loaded bundle generation.
    pub generation: String,
    /// Repository-relative file and story export.
    pub story_id: String,
    /// Validated complete props of the story page.
    pub props: BTreeMap<String, Value>,
    /// Viewport identifier.
    pub viewport: String,
    /// Effective colour scheme.
    pub color_scheme: ColorScheme,
}

/// Render a synchronous complete page document.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[ts(rename = "RenderPageParams")]
pub struct RenderPage {
    /// Loaded bundle generation.
    pub generation: String,
    /// Repository-relative module and export name.
    pub handle: String,
}

/// Consumer PostCSS transformation inputs.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "ProcessCssParams")]
pub struct ProcessCss {
    /// Physical repositories whose local packages map into this side.
    pub repository_roots: Vec<String>,
    /// Core-chosen stylesheet generation context.
    pub context: String,
    /// Side source checkout.
    pub source_root: String,
    /// Consumer module resolution policy for this side.
    pub module_resolution: ModuleResolution,
    /// Consumer PostCSS module as a repository-relative path without `.` or `..` segments.
    pub postcss: String,
    /// Logical stylesheet source path, relative to sourceRoot or a selected dependency root.
    pub source_path: String,
    /// Stylesheet source text.
    pub text: String,
}

/// Core-generated CSS Modules maps supplied before evaluation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CssModulesParams")]
pub struct CssModules {
    /// Loaded bundle generation.
    pub generation: String,
    /// Logical stylesheet path to original-name/scoped-name map.
    pub class_maps: BTreeMap<String, BTreeMap<String, String>>,
    /// Vite's named CSS Module bindings, grouped by logical stylesheet path.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub named_exports: Option<BTreeMap<String, BTreeMap<String, String>>>,
}

/// Optional process diagnostics selected by the core during hello.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[ts(rename = "HelloParams")]
pub struct Hello {
    /// Enable disk capture witnesses only when this pool has a bundle store.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub capture: Option<CaptureHint>,
    /// Enable process-local timing records on standard error for this session.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    #[ts(optional, as = "Option<bool>")]
    pub timings: bool,
}

pub(crate) fn disabled(value: &bool) -> bool {
    !value
}

/// Every protocol method, encoded as method and params.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "method", content = "params", rename_all = "camelCase")]
pub enum Call {
    /// Exchange package versions.
    Hello(Hello),
    /// Read the stories configuration of one Storybook folder.
    ReadStorybook(ReadStorybookParams),
    /// Compile without evaluating consumer modules.
    Bundle(BundleRequest),
    /// Restore an immutable compiled generation in another worker.
    RestoreGeneration(Box<RestoreGeneration>),
    /// Evaluate and inventory definitions.
    Describe(Generation),
    /// Install the resolved handle table after describe.
    Bindings(Bindings),
    /// Render a React screen.
    RenderScreen(Render),
    /// Render a registered component.
    RenderComponent(RenderComponent),
    /// Render a composed story.
    RenderStory(RenderStory),
    /// Render a complete page document.
    RenderPage(RenderPage),
    /// Run consumer PostCSS.
    ProcessCss(ProcessCss),
    /// Run the Vite setup on an inline stylesheet.
    TransformViteCss(TransformViteCss),
    /// Install CSS Modules class maps.
    CssModules(CssModules),
    /// Release one bundle generation.
    Dispose(Generation),
    /// Start a `bundle` request's PostCSS preparation without waiting for its child.
    PrepareContext(PrepareContext),
    /// Release one stylesheet context.
    DisposeContext(DisposeContext),
    /// Drain in-flight work and exit.
    Shutdown(Empty),
}

#[cfg(test)]
#[path = "_tests_/vite_methods_tests.rs"]
mod vite_methods_tests;
