//! Request payloads for every sidecar method.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::bindings::{Bindings, DisposeContext, EntryBinding, SlotInput};
use crate::compiled::RestoreGeneration;

/// A request with no method parameters.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "EmptyParams")]
pub struct Empty {}

/// A loaded bundle generation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "GenerationParams")]
pub struct Generation {
    /// Content-addressed generation id.
    pub generation: String,
}

/// Consumer module resolution settings; list order is meaningful.
#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModuleResolution {
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
}

/// Inputs compiled into one unevaluated bundle.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(rename = "BundleParams")]
pub struct Bundle {
    /// Core input digest that isolates resolved bindings and CSS Modules lifetimes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub evaluation: Option<String>,
    /// Entry module files.
    pub entry_files: Vec<String>,
    /// Optional consumer renderer module.
    pub renderer: Option<String>,
    /// Storybook files.
    pub stories_files: Vec<String>,
    /// Consumer resolution policy.
    pub module_resolution: ModuleResolution,
    /// Source checkout or extracted base root.
    pub source_root: String,
    /// Configuration directory relative to the side source root.
    pub configuration_directory: String,
    /// Physical repository roots whose local packages map into this side.
    pub repository_roots: Vec<String>,
}

/// Preview colour scheme.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ColorScheme {
    /// Light appearance.
    Light,
    /// Dark appearance.
    Dark,
}

/// Enclosing material-ignore scope at a component invocation.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, TS)]
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

/// Render a composed Storybook story with data args overlaid.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(rename = "RenderStoryParams")]
pub struct RenderStory {
    /// Loaded bundle generation.
    pub generation: String,
    /// Repository-relative file and story export.
    pub story_id: String,
    /// Validated merged data args.
    pub props: BTreeMap<String, Value>,
    /// Viewport identifier.
    pub viewport: String,
    /// Effective colour scheme.
    pub color_scheme: ColorScheme,
}

/// Render a synchronous complete page document.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "RenderPageParams")]
pub struct RenderPage {
    /// Loaded bundle generation.
    pub generation: String,
    /// Repository-relative module and export name.
    pub handle: String,
}

/// Consumer PostCSS transformation inputs.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
    /// Consumer PostCSS module path.
    pub postcss: String,
    /// Logical stylesheet source path, relative to sourceRoot or a selected dependency root.
    pub source_path: String,
    /// Stylesheet source text.
    pub text: String,
}

/// Core-generated CSS Modules maps supplied before evaluation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(rename = "CssModulesParams")]
pub struct CssModules {
    /// Loaded bundle generation.
    pub generation: String,
    /// Logical stylesheet path to original-name/scoped-name map.
    pub class_maps: BTreeMap<String, BTreeMap<String, String>>,
}

/// Every protocol method, encoded as method and params.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "method",
    content = "params",
    rename_all = "camelCase",
    deny_unknown_fields
)]
pub enum Call {
    /// Exchange package versions.
    Hello(Empty),
    /// Compile without evaluating consumer modules.
    Bundle(Bundle),
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
    /// Install CSS Modules class maps.
    CssModules(CssModules),
    /// Release one bundle generation.
    Dispose(Generation),
    /// Release one stylesheet context.
    DisposeContext(DisposeContext),
    /// Drain in-flight work and exit.
    Shutdown(Empty),
}

impl Call {
    /// Protocol default deadline; the process pool applies environment overrides.
    pub fn timeout_ms(&self) -> u64 {
        match self {
            Self::Bundle(_) | Self::Describe(_) => 120_000,
            Self::ProcessCss(_) => 60_000,
            _ => 30_000,
        }
    }
}
