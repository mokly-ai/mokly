//! Stable bundle settings exclude authored HTML membership.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_graph::types::RenderGeneration;
use mokly_model::material::digest;
use mokly_sidecar::bundle_params::ViteSetupInputs;
use mokly_sidecar::methods::Bundle;
use mokly_source_interface::tree::SourceTree;

use crate::error::{InternalError, Result};
use crate::runtime::Runtime;
use crate::side::{SideInputs, dependency_roots};

pub(crate) fn vite_setup(
    runtime: &Runtime,
    config: &ResolvedConfig,
) -> Option<Arc<ViteSetupInputs>> {
    if !config.vite() {
        return None;
    }
    let last = runtime.vite_inventory(config);
    let sources = last.as_ref().map_or(&[][..], |generation| {
        generation.catalogue().model.sources.as_slice()
    });
    let rebuild_files =
        mokly_graph::watch_rules::rebuild_files(config, runtime.tree.as_ref(), sources);
    let base_env = runtime
        .vite_base_env
        .as_ref()
        .map(|env| env.transport.clone());
    (!rebuild_files.is_empty() || base_env.is_some()).then(|| {
        Arc::new(ViteSetupInputs {
            rebuild_files,
            base_env,
        })
    })
}

impl Runtime {
    /// The source inventory used to exclude package-owned Vite rebuild matches.
    pub fn vite_inventory(&self, config: &ResolvedConfig) -> Option<Arc<dyn RenderGeneration>> {
        self.vite_inventory
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .as_ref()
            .filter(|(file, _)| config.vite() && file == &config.file)
            .and_then(|(_, generation)| generation.upgrade())
    }
}

pub(crate) fn params(config: &ResolvedConfig, files: &[SourceFile], side: &SideInputs) -> Bundle {
    Bundle {
        vite: config.vite(),
        vite_inputs: side.vite_inputs.clone(),
        evaluation: None,
        entry_files: files
            .iter()
            .filter(|file| file.kind == SourceKind::Module)
            .map(|file| file.path.clone())
            .collect(),
        stories_files: files
            .iter()
            .filter(|file| file.kind == SourceKind::Stories)
            .map(|file| file.path.clone())
            .collect(),
        renderer: config.renderer(),
        module_resolution: side.module_resolution.clone(),
        source_root: side.source_root.to_string_lossy().into_owned(),
        configuration_directory: side.configuration_directory.clone(),
        repository_roots: side
            .repository_roots
            .iter()
            .map(|root| root.to_string_lossy().into_owned())
            .collect(),
    }
}

pub(crate) fn cache_key(
    config: &ResolvedConfig,
    params: &Bundle,
    side: &SideInputs,
    tree: &dyn SourceTree,
) -> Result<String> {
    let roots: Vec<_> = dependency_roots(side)
        .into_iter()
        .map(|path| match tree.project(&path) {
            Ok(Some(node)) => node.identity,
            _ => path,
        })
        .collect();
    match serde_json::to_vec(&(params, &config.input.roots, roots)) {
        Ok(bytes) => Ok(digest(&bytes)),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_inputs_tests.rs"]
mod bundle_inputs_tests;
