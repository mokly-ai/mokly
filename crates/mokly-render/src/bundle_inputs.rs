//! Stable bundle settings exclude authored HTML membership.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_model::material::digest;
use mokly_sidecar::methods::Bundle;
use mokly_source_interface::tree::SourceTree;

use crate::error::{InternalError, Result};
use crate::side::{SideInputs, dependency_roots};

pub(crate) fn params(config: &ResolvedConfig, files: &[SourceFile], side: &SideInputs) -> Bundle {
    Bundle {
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
