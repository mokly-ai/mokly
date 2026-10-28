//! Bundle inputs that every render input key of one side shares, without a source root.

use std::collections::BTreeMap;

use mokly_model::material::digest;
use mokly_sidecar::methods::{Bundle, ModuleResolution};
use mokly_sidecar::results;
use serde::Serialize;

use crate::error::{InternalError, Result};

/// The reserved logical prefix of installation metadata outside a side's source root.
const INSTALLED: &str = "node_modules/.mokly-roots/installed/";

/// Storybook preview candidates. Story keys cover the preview through its module closure.
const PREVIEWS: [&str; 6] = [
    ".storybook/preview.tsx",
    ".storybook/preview.ts",
    ".storybook/preview.jsx",
    ".storybook/preview.js",
    ".storybook/preview.mjs",
    ".storybook/preview.cjs",
];

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
}

/// Every bundle setting except the source root, the entry lists, and the evaluation.
#[derive(Serialize)]
struct Settings<'a> {
    renderer: &'a Option<String>,
    module_resolution: &'a ModuleResolution,
    configuration_directory: &'a str,
    repository_roots: &'a [String],
    dependency_roots: &'a [String],
    peers: Option<&'a BTreeMap<String, Option<String>>>,
}

/// Derive the shared render-key inputs from one bundle request, its result, and its maps.
pub(crate) fn derive(
    params: &Bundle,
    result: &results::Bundle,
    maps: &ClassMaps,
) -> Result<RenderEnvironment> {
    let compiled = result.compiled.as_ref();
    let settings = Settings {
        renderer: &params.renderer,
        module_resolution: &params.module_resolution,
        configuration_directory: &params.configuration_directory,
        repository_roots: &params.repository_roots,
        dependency_roots: compiled.map_or(&[], |compiled| &compiled.dependency_roots),
        peers: compiled.map(|compiled| &compiled.peers),
    };
    let resolution_digests = compiled
        .map(|compiled| resolution(&compiled.metadata_inputs))
        .unwrap_or_default();
    let mut class_map_digests = BTreeMap::new();
    for (path, map) in maps {
        class_map_digests.insert(path.clone(), json_digest(map)?);
    }
    Ok(RenderEnvironment {
        environment: json_digest(&settings)?,
        resolution_digests,
        class_map_digests,
    })
}

/// Keep present resolution files under the names that both sides give them.
pub(crate) fn resolution(inputs: &BTreeMap<String, Option<String>>) -> BTreeMap<String, String> {
    inputs
        .iter()
        .filter(|(name, _)| !PREVIEWS.contains(&name.as_str()))
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
