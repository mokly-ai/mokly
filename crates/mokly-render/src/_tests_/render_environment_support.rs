//! Shared bundle inputs for render environment tests.

use std::collections::BTreeMap;
use std::path::Path;

use mokly_sidecar::compiled::CompiledGeneration;
use mokly_sidecar::methods::{Bundle, ModuleResolution};
use mokly_sidecar::results;

use crate::error::Result;

use super::{ClassMaps, RenderEnvironment};

pub(super) fn physical(path: &str) -> String {
    if cfg!(windows) && path.starts_with('/') {
        format!("C:{path}")
    } else {
        path.into()
    }
}

pub(super) fn derive(
    params: &Bundle,
    result: &results::Bundle,
    maps: &ClassMaps,
) -> Result<RenderEnvironment> {
    super::derive(
        params,
        result,
        maps,
        Path::new(&physical("/work/repo")),
        None,
    )
}

pub(super) fn derive_at(
    params: &Bundle,
    result: &results::Bundle,
    maps: &ClassMaps,
    working_root: &str,
    cache_namespace: Option<&str>,
) -> Result<RenderEnvironment> {
    let working_root = physical(working_root);
    let cache_namespace = cache_namespace.map(physical);
    super::derive(
        params,
        result,
        maps,
        Path::new(&working_root),
        cache_namespace.as_deref().map(Path::new),
    )
}

pub(super) fn params(source_root: &str) -> Bundle {
    Bundle {
        evaluation: Some(format!("evaluation of {source_root}")),
        entry_files: vec![format!("{source_root}-entries")],
        renderer: Some("renderer.tsx".into()),
        stories_files: Vec::new(),
        module_resolution: ModuleResolution {
            dependency_root: Some(physical("/work/repo")),
            package_roots: vec![physical("/work/repo")],
            ..ModuleResolution::default()
        },
        source_root: source_root.into(),
        configuration_directory: "examples/basic".into(),
        repository_roots: vec![physical("/work/repo")],
    }
}

pub(super) fn params_at(root: &str) -> Bundle {
    let root = physical(root);
    Bundle {
        evaluation: Some(format!("evaluation of {root}")),
        entry_files: vec![format!("{root}/specs/entries")],
        renderer: Some("renderer.tsx".into()),
        stories_files: Vec::new(),
        module_resolution: ModuleResolution {
            dependency_root: Some(root.clone()),
            package_roots: vec![format!("{root}/examples/basic"), root.clone()],
            ..ModuleResolution::default()
        },
        source_root: root.clone(),
        configuration_directory: "examples/basic".into(),
        repository_roots: vec![root],
    }
}

pub(super) fn result(dependency_root: &str, react: &str) -> results::Bundle {
    results::Bundle {
        unmapped_dependency_directories: None,
        epoch: 0,
        compiled: Some(CompiledGeneration {
            unmapped_dependency_directories: None,
            identity: "identity".into(),
            code: String::new(),
            runtime_key: String::new(),
            dependency_roots: vec![physical(dependency_root)],
            css_modules: Vec::new(),
            sources: BTreeMap::new(),
            peers: BTreeMap::from([("react".to_owned(), Some(physical(react)))]),
            inputs: BTreeMap::new(),
            metadata_inputs: BTreeMap::from([("package.json".to_owned(), Some("root".to_owned()))]),
            input_directories: BTreeMap::new(),
            metadata_directories: BTreeMap::new(),
        }),
        generation: "generation".into(),
        modules: Vec::new(),
        warnings: Vec::new(),
    }
}

pub(super) fn cache_params(root: &str, namespace: &str) -> Bundle {
    let root = physical(root);
    let namespace = physical(namespace);
    let source_root = format!("{namespace}/sources/entries/base/data");
    let dependency_root = format!("{namespace}/dependencies/entries/install/data");
    Bundle {
        evaluation: Some("evaluation".into()),
        entry_files: vec!["specs/entries".into()],
        renderer: Some("renderer.tsx".into()),
        stories_files: Vec::new(),
        module_resolution: ModuleResolution {
            dependency_root: Some(dependency_root.clone()),
            package_roots: vec![format!("{dependency_root}/node_modules")],
            ..ModuleResolution::default()
        },
        source_root,
        configuration_directory: "examples/basic".into(),
        repository_roots: vec![root, dependency_root],
    }
}

pub(super) fn maps(local: &str) -> ClassMaps {
    BTreeMap::from([
        (
            "a.module.css".to_owned(),
            BTreeMap::from([(local.to_owned(), format!("scoped-{local}"))]),
        ),
        (
            "b.module.css".to_owned(),
            BTreeMap::from([("card".to_owned(), "scoped-card".to_owned())]),
        ),
    ])
}
