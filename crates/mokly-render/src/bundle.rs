//! Bundle, prepare CSS Modules, and describe in the required evaluation order.

use std::collections::BTreeMap;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_model::material::digest;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{Bundle, Call, CssModules, Generation};
use mokly_sidecar::wire::MethodResult;

use crate::error::{InternalError, RenderError, Result};
use crate::runtime::Runtime;
use crate::stylesheets;

#[derive(Clone)]
pub(crate) struct BundleState {
    pub(crate) class_maps_digest: String,
    pub(crate) definitions: Definitions,
}

pub(crate) fn describe(
    runtime: &Runtime,
    config: &ResolvedConfig,
    files: &[SourceFile],
) -> Result<(JavaScriptGeneration, Definitions)> {
    let side = runtime.side(config)?;
    let entries: Vec<_> = files
        .iter()
        .filter(|file| file.kind == SourceKind::Module)
        .map(|file| file.path.clone())
        .collect();
    let stories: Vec<_> = files
        .iter()
        .filter(|file| file.kind == SourceKind::Stories)
        .map(|file| file.path.clone())
        .collect();
    let renderer = config.input.renderer.as_ref().map(|renderer| {
        relative(
            &config
                .file
                .parent()
                .unwrap_or(&config.repo_root)
                .join(renderer),
            &config.repo_root,
        )
    });
    let params = Bundle {
        entry_files: entries.clone(),
        stories_files: stories.clone(),
        renderer: renderer.clone(),
        module_resolution: side.module_resolution.clone(),
        source_root: side.source_root.to_string_lossy().into_owned(),
        configuration_directory: side.configuration_directory.clone(),
        repository_roots: side
            .repository_roots
            .iter()
            .map(|root| root.to_string_lossy().into_owned())
            .collect(),
    };
    let result = match runtime.pool.request(Call::Bundle(params.clone())) {
        Ok(MethodResult::Bundle(result)) => result,
        Ok(_) => return Err(RenderError::ResultKind { method: "bundle" }),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    for directory in result.unmapped_dependency_directories.iter().flatten() {
        runtime.dependency_usage.unmapped(directory);
    }
    let modules: BTreeMap<_, _> = result
        .modules
        .into_iter()
        .map(|module| (module.path, module.imports))
        .collect();
    for path in modules.keys() {
        runtime
            .dependency_usage
            .record(&side.dependency_aliases, path);
    }
    let compiler = stylesheets::compiler(runtime, config, &side);
    let roots = stylesheets::roots(
        &modules,
        renderer.as_deref(),
        &entries.into_iter().chain(stories).collect::<Vec<_>>(),
        &side.module_resolution.loaders,
    );
    let mut class_maps = BTreeMap::new();
    for root in roots {
        match compiler.bundle(&root) {
            Ok(bundle) => class_maps.extend(bundle.css_modules),
            Err(source) => return Err(RenderError::Css { source }),
        }
    }
    for path in modules.keys().filter(|path| path.ends_with(".module.css")) {
        if !class_maps.contains_key(path)
            && !stylesheets::ignored(path, &side.module_resolution.loaders)
        {
            let root = mokly_css::types::StylesheetRoot {
                path: path.clone(),
                stylesheets: vec![path.clone()],
                excluded: Default::default(),
                local_css: true,
            };
            match compiler.bundle(&root) {
                Ok(bundle) => class_maps.extend(bundle.css_modules),
                Err(source) => return Err(RenderError::Css { source }),
            }
        }
    }
    let maps = match serde_json::to_vec(&class_maps) {
        Ok(bytes) => bytes,
        Err(source) => return Err(InternalError::Json { source }.into()),
    };
    let class_maps_digest = digest(&maps);
    let previous = runtime
        .bundles
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .get(&result.generation)
        .cloned();
    if let Some(previous) = previous {
        if previous.class_maps_digest == class_maps_digest {
            return Ok((
                JavaScriptGeneration {
                    id: result.generation,
                    modules,
                    class_maps_digest,
                    css_context: side.context,
                },
                previous.definitions,
            ));
        }
        match runtime.pool.request(Call::Dispose(Generation {
            generation: result.generation.clone(),
        })) {
            Ok(MethodResult::Empty) => {}
            Ok(_) => return Err(RenderError::ResultKind { method: "dispose" }),
            Err(source) => return Err(RenderError::Sidecar { source }),
        }
        match runtime.pool.request(Call::Bundle(params)) {
            Ok(MethodResult::Bundle(reloaded)) if reloaded.generation == result.generation => {}
            Ok(_) => {
                return Err(RenderError::ResultKind {
                    method: "bundle replay",
                });
            }
            Err(source) => return Err(RenderError::Sidecar { source }),
        }
    }
    match runtime.pool.request(Call::CssModules(CssModules {
        generation: result.generation.clone(),
        class_maps,
    })) {
        Ok(MethodResult::Empty) => {}
        Ok(_) => {
            return Err(RenderError::ResultKind {
                method: "cssModules",
            });
        }
        Err(source) => return Err(RenderError::Sidecar { source }),
    }
    let definitions = match runtime.pool.request(Call::Describe(Generation {
        generation: result.generation.clone(),
    })) {
        Ok(MethodResult::Definitions(result)) => result,
        Ok(_) => return Err(RenderError::ResultKind { method: "describe" }),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    runtime
        .bundles
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .insert(
            result.generation.clone(),
            BundleState {
                class_maps_digest: class_maps_digest.clone(),
                definitions: definitions.clone(),
            },
        );
    Ok((
        JavaScriptGeneration {
            id: result.generation,
            modules,
            class_maps_digest,
            css_context: side.context,
        },
        definitions,
    ))
}
