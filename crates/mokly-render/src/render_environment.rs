//! Bundle inputs that every render input key of one side shares, without a source root.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use mokly_graph::render_inputs::PREVIEWS;
use mokly_model::material::digest;
use mokly_sidecar::methods::{Bundle, ModuleResolution};
use mokly_sidecar::results;
use serde::Serialize;

use crate::error::{InternalError, Result};

/// The reserved logical prefix of installation metadata outside a side's source root.
const INSTALLED: &str = "node_modules/.mokly-roots/installed/";

/// Stylesheet path to its local-to-scoped CSS Modules class names.
pub(crate) type ClassMaps = BTreeMap<String, BTreeMap<String, String>>;

/// The render-key digests of one bundle, retained with its evaluated state.
#[derive(Clone, Debug, Default)]
pub(crate) struct RenderEnvironment {
    /// Bundle settings, selected installation, and resolved runtime packages.
    pub(crate) environment: String,
    /// Present resolution files by logical name without the installed-input prefix.
    pub(crate) resolution_digests: BTreeMap<String, String>,
    /// Stylesheet path to the digest of its class map.
    pub(crate) class_map_digests: BTreeMap<String, String>,
    /// Package names of the resolved runtime packages.
    pub(crate) runtime_packages: BTreeSet<String>,
}

/// Every bundle setting except the source root, the entry lists, and the evaluation.
#[derive(Serialize)]
struct Settings {
    renderer: Option<String>,
    module_resolution: ModuleResolution,
    configuration_directory: String,
    repository_roots: Vec<String>,
    dependency_roots: Vec<String>,
    peers: Option<BTreeMap<String, Option<String>>>,
}

/// Convert physical settings to names that are stable across equivalent checkouts.
struct PathMapper<'a> {
    working_root: &'a Path,
    cache_namespace: Option<&'a Path>,
    external: BTreeSet<String>,
}

impl<'a> PathMapper<'a> {
    fn new(working_root: &'a Path, cache_namespace: Option<&'a Path>) -> Self {
        Self {
            working_root,
            cache_namespace,
            external: BTreeSet::new(),
        }
    }

    fn map(&mut self, value: &str) -> String {
        let path = Path::new(value);
        if !path.is_absolute() {
            return value.to_owned();
        }
        if let Ok(relative) = path.strip_prefix(self.working_root) {
            return logical(relative, "");
        }
        if let Some(cache_namespace) = self.cache_namespace
            && let Ok(relative) = path.strip_prefix(cache_namespace)
        {
            return logical(relative, "cache:");
        }
        self.external.insert(value.to_owned());
        value.to_owned()
    }

    fn report_external(&self) {
        if !self.external.is_empty() {
            tracing::warn!(
                paths = ?self.external,
                "render environment contains absolute paths outside the working repository and comparison cache"
            );
        }
    }
}

fn logical(path: &Path, prefix: &str) -> String {
    let relative = path.to_string_lossy().replace('\\', "/");
    if relative.is_empty() {
        format!("{prefix}.")
    } else {
        format!("{prefix}{relative}")
    }
}

/// Derive the shared render-key inputs from one bundle request, its result, and its maps.
pub(crate) fn derive(
    params: &Bundle,
    result: &results::Bundle,
    maps: &ClassMaps,
    working_root: &Path,
    cache_namespace: Option<&Path>,
) -> Result<RenderEnvironment> {
    let compiled = result.compiled.as_ref();
    let mut paths = PathMapper::new(working_root, cache_namespace);
    let settings = settings(params, result, &mut paths);
    paths.report_external();
    let previewed = result
        .modules
        .iter()
        .any(|module| PREVIEWS.contains(&module.path.as_str()));
    let resolution_digests = compiled
        .map(|compiled| resolution(&compiled.metadata_inputs, previewed))
        .unwrap_or_default();
    let mut class_map_digests = BTreeMap::new();
    for (path, map) in maps {
        class_map_digests.insert(path.clone(), json_digest(map)?);
    }
    Ok(RenderEnvironment {
        environment: json_digest(&settings)?,
        resolution_digests,
        class_map_digests,
        runtime_packages: compiled
            .map(|compiled| compiled.peers.keys().map(|peer| package(peer)).collect())
            .unwrap_or_default(),
    })
}

fn settings(params: &Bundle, result: &results::Bundle, paths: &mut PathMapper<'_>) -> Settings {
    let mut module_resolution = params.module_resolution.clone();
    module_resolution.dependency_root = module_resolution
        .dependency_root
        .as_deref()
        .map(|path| paths.map(path));
    module_resolution.package_roots = module_resolution
        .package_roots
        .iter()
        .map(|path| paths.map(path))
        .collect();
    module_resolution.aliases = module_resolution
        .aliases
        .iter()
        .map(|(alias, target)| (paths.map(alias), paths.map(target)))
        .collect();
    Settings {
        renderer: params.renderer.as_deref().map(|path| paths.map(path)),
        module_resolution,
        configuration_directory: paths.map(&params.configuration_directory),
        repository_roots: params
            .repository_roots
            .iter()
            .map(|path| paths.map(path))
            .collect(),
        dependency_roots: result
            .compiled
            .as_ref()
            .map(|compiled| {
                compiled
                    .dependency_roots
                    .iter()
                    .map(|path| paths.map(path))
                    .collect()
            })
            .unwrap_or_default(),
        peers: result.compiled.as_ref().map(|compiled| {
            compiled
                .peers
                .iter()
                .map(|(name, path)| (name.clone(), path.as_deref().map(|path| paths.map(path))))
                .collect()
        }),
    }
}

/// The package of a runtime package specifier, such as `@emotion/server` for
/// `@emotion/server/create-instance`.
fn package(specifier: &str) -> String {
    let segments = if specifier.starts_with('@') { 2 } else { 1 };
    specifier
        .split('/')
        .take(segments)
        .collect::<Vec<_>>()
        .join("/")
}

/// Keep present resolution files under the names that both sides give them.
///
/// The preview candidates leave only when the module graph names the preview, because
/// story keys then cover it through its closure. A preview that the graph does not
/// name stays, so that story keys fall back to the whole bundle.
pub(crate) fn resolution(
    inputs: &BTreeMap<String, Option<String>>,
    previewed: bool,
) -> BTreeMap<String, String> {
    inputs
        .iter()
        .filter(|(name, _)| !previewed || !PREVIEWS.contains(&name.as_str()))
        .filter_map(|(name, value)| {
            let name = name.strip_prefix(INSTALLED).unwrap_or(name);
            value.as_ref().map(|value| (name.to_owned(), value.clone()))
        })
        .collect()
}

fn json_digest(value: &impl Serialize) -> Result<String> {
    match serde_json::to_vec(value) {
        Ok(bytes) => Ok(digest(&bytes)),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/render_environment_tests.rs"]
mod render_environment_tests;

#[cfg(test)]
#[path = "_tests_/render_environment_support.rs"]
mod render_environment_support;

#[cfg(test)]
#[path = "_tests_/render_environment_paths_tests.rs"]
mod render_environment_paths_tests;
