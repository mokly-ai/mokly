//! Strict, data-only authored configuration shapes.

use std::collections::BTreeMap;
use std::path::PathBuf;

use mokly_model::axes::ColorScheme;
use serde::{Deserialize, Serialize};

/// Data-only JSON configuration, validated before resolution.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Config {
    /// Editor schema reference; never fetched or executed.
    #[serde(rename = "$schema")]
    pub schema: Option<String>,
    /// Root definitions in configured order.
    pub roots: Option<Vec<RootConfig>>,
    /// Config-relative repository root.
    pub repo_root: Option<String>,
    /// Light-first effective scheme set.
    pub color_schemes: Option<Vec<ColorScheme>>,
    /// Optional consumer React provider module.
    pub renderer: Option<String>,
    /// Optional consumer PostCSS module.
    pub postcss: Option<String>,
    /// Consumer bundler resolution settings.
    pub module_resolution: Option<ModuleResolution>,
    /// Ordered route-to-stylesheet rules.
    pub stylesheets: Option<Vec<StylesheetRule>>,
    /// Comparison settings.
    pub review: Option<ReviewConfig>,
    /// Additional watch settings.
    pub watch: Option<WatchConfig>,
}

/// One root's authored selection and identity rules.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RootConfig {
    /// Config-relative existing directory.
    pub dir: String,
    /// Safe relative POSIX globs, or the default entry globs.
    pub files: Option<Vec<String>>,
    /// Complete path prefix, when present.
    pub path: Option<String>,
    /// Directory names omitted from derived paths.
    pub transparent: Option<Vec<String>>,
}

/// Consumer module resolution options.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModuleResolution {
    /// Bare package aliases.
    pub aliases: Option<BTreeMap<String, String>>,
    /// Ordered resolution conditions.
    pub conditions: Option<Vec<String>>,
    /// Extension loaders; CSS extensions accept only empty.
    pub loaders: Option<BTreeMap<String, ModuleLoader>>,
    /// Ordered package entry fields.
    pub main_fields: Option<Vec<String>>,
    /// Config-relative consumer package roots.
    pub package_roots: Option<Vec<String>>,
    /// Ordered extension lookup list.
    pub resolve_extensions: Option<Vec<String>>,
}

/// Supported sidecar loaders. CSS is owned by the core.
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ModuleLoader {
    /// Base64 string.
    Base64,
    /// Binary data.
    Binary,
    /// Data URL.
    Dataurl,
    /// Empty module.
    Empty,
    /// File artifact, validated by the import stage.
    File,
    /// JavaScript.
    Js,
    /// JSON.
    Json,
    /// JSX.
    Jsx,
    /// Plain string.
    Text,
    /// TypeScript.
    Ts,
    /// TypeScript JSX.
    Tsx,
}

/// Route-to-stylesheet rule, in authored order.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StylesheetRule {
    /// Catalogue route matcher.
    pub r#match: String,
    /// Shared CSS paths, URLs, and the component stylesheet token.
    pub stylesheets: Vec<String>,
    /// Light-only CSS paths and URLs.
    pub light_stylesheets: Option<Vec<String>>,
    /// Dark-only CSS paths and URLs.
    pub dark_stylesheets: Option<Vec<String>>,
}

/// Comparison configuration.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewConfig {
    /// Git base ref, default origin/main.
    pub base: Option<String>,
}

/// Additional watched authored inputs.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WatchConfig {
    /// Nonnegative debounce interval, default 75.
    pub debounce_ms: Option<f64>,
    /// Ordered additional watch rules.
    pub rules: Option<Vec<WatchRule>>,
}

/// One additional watch classification.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct WatchRule {
    /// Desired classification, below package-owned classifications.
    pub action: WatchAction,
    /// Repository-relative safe globs.
    pub paths: Vec<String>,
}

/// Authored additional watch action.
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WatchAction {
    /// Ignore unrelated matching files.
    Ignore,
    /// Rebuild on a matching authored input.
    Rebuild,
    /// Reload on a matching public asset.
    Reload,
}

/// Configuration paths resolved through one source-tree identity pass.
#[derive(Clone, Debug)]
pub struct ResolvedConfig {
    /// Authored settings, with schemes and ordered lists normalized.
    pub input: Config,
    /// Configuration file in the source tree.
    pub file: PathBuf,
    /// Canonical repository identity.
    pub repo_root: PathBuf,
    /// Confined config, module, and local stylesheet sources, with physical aliases.
    pub authored_inputs: Vec<PathBuf>,
    /// Root definitions with their lexical and physical directories.
    pub roots: Vec<ResolvedRoot>,
}

/// One root with its projected physical identity.
#[derive(Clone, Debug)]
pub struct ResolvedRoot {
    /// Authored root fields.
    pub input: RootConfig,
    /// Lexical source-tree root.
    pub directory: PathBuf,
    /// Canonical root identity.
    pub identity: PathBuf,
}
