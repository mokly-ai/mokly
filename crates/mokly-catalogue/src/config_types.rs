//! Strict, data-only authored configuration shapes.

use std::collections::BTreeMap;
use std::path::PathBuf;

use mokly_model::axes::ColorScheme;
use serde::de::value::MapAccessDeserializer;
use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Data-only JSON configuration, validated before resolution.
#[derive(Clone, Debug, PartialEq, Default, Deserialize, Serialize)]
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
    /// Use the project's Vite setup for JavaScript compilation.
    #[serde(skip_serializing_if = "vite_disabled")]
    pub vite: Option<ViteConfig>,
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
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
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

/// The opt-in Vite adapter switch or its currently empty options.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(untagged)]
pub enum ViteConfig {
    /// Explicitly enable or disable the adapter.
    Flag(bool),
    /// Enable the adapter with its default setup.
    Options(ViteOptions),
}

/// Reserved adapter options, with no authored fields yet.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ViteOptions {}

fn vite_disabled(value: &Option<ViteConfig>) -> bool {
    matches!(value, None | Some(ViteConfig::Flag(false)))
}

/// Consumer module resolution options.
#[derive(Clone, Debug, PartialEq, Default, Deserialize, Serialize)]
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
    /// Workspace source overrides keyed by package name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_packages: Option<SourcePackages>,
}

/// Source overrides for the workspace packages of one configuration.
pub type SourcePackages = BTreeMap<String, SourcePackage>;

/// One package's replacement layout or an explicit end to layout lookup.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SourcePackage {
    /// Keep the original target at this point in the lookup order.
    Disabled,
    /// Map each build folder to its source folder relative to the package.
    Folders(BTreeMap<String, String>),
}

impl Serialize for SourcePackage {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Disabled => serializer.serialize_bool(false),
            Self::Folders(folders) => folders.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for SourcePackage {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Entry;

        impl<'de> Visitor<'de> for Entry {
            type Value = SourcePackage;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("false or a build-to-source folder map")
            }

            fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
                if value {
                    return Err(E::invalid_value(de::Unexpected::Bool(value), &self));
                }
                Ok(SourcePackage::Disabled)
            }

            fn visit_map<M: MapAccess<'de>>(self, map: M) -> Result<Self::Value, M::Error> {
                BTreeMap::deserialize(MapAccessDeserializer::new(map)).map(SourcePackage::Folders)
            }
        }

        deserializer.deserialize_any(Entry)
    }
}

/// Supported sidecar loaders. CSS is owned by the core.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize)]
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
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
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
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewConfig {
    /// Git base ref, default origin/main.
    pub base: Option<String>,
    /// Run lifecycle scripts during base dependency installation when enabled.
    #[serde(rename = "baseInstallScripts")]
    pub base_install_scripts: Option<bool>,
}

/// Additional watched authored inputs.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WatchConfig {
    /// Nonnegative debounce interval, default 75.
    pub debounce_ms: Option<f64>,
    /// Ordered additional watch rules.
    pub rules: Option<Vec<WatchRule>>,
}

/// One additional watch classification.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct WatchRule {
    /// Desired classification, below package-owned classifications.
    pub action: WatchAction,
    /// Repository-relative safe globs.
    pub paths: Vec<String>,
}

/// Authored additional watch action.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize)]
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
#[derive(Clone, Debug, PartialEq)]
pub struct ResolvedConfig {
    /// Authored settings, with schemes and ordered lists normalized.
    pub input: Config,
    /// Configuration file in the source tree.
    pub file: PathBuf,
    /// Canonical repository identity.
    pub repo_root: PathBuf,
    /// Configured modules under their resolved repository-relative source identities.
    pub modules: ResolvedModules,
    /// Confined config, module, and local stylesheet sources, with physical aliases.
    pub authored_inputs: Vec<PathBuf>,
    /// Root definitions with their lexical and physical directories.
    pub roots: Vec<ResolvedRoot>,
}

impl ResolvedConfig {
    /// Whether this side compiles JavaScript through its project's Vite setup.
    pub fn vite(&self) -> bool {
        !vite_disabled(&self.input.vite)
    }

    /// Normalized source overrides authored by this side.
    pub fn source_packages(&self) -> Option<&SourcePackages> {
        self.input
            .module_resolution
            .as_ref()?
            .source_packages
            .as_ref()
    }
}

/// Configured module identities and retained source resolution settings.
#[derive(Clone, Debug, PartialEq, Default, Serialize)]
pub struct ResolvedModules {
    /// Renderer module's repository-relative POSIX identity.
    pub renderer: Option<String>,
    /// PostCSS module's repository-relative POSIX identity.
    pub postcss: Option<String>,
    /// Working override map attached when the base configuration loads.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_source_packages: Option<SourcePackages>,
}

/// One root with its projected physical identity.
#[derive(Clone, Debug, PartialEq)]
pub struct ResolvedRoot {
    /// Authored root fields.
    pub input: RootConfig,
    /// Lexical source-tree root.
    pub directory: PathBuf,
    /// Canonical root identity.
    pub identity: PathBuf,
}

#[cfg(test)]
#[path = "_tests_/config_vite_tests.rs"]
mod config_vite_tests;
