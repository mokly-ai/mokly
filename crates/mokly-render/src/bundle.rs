//! Bundle only changed JavaScript and isolate class maps across retained graphs.

use std::collections::BTreeMap;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_css::types::{StylesheetBundler, StylesheetRoot};
use mokly_model::material::digest;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{Bundle, Call, CssModules, Generation};
use mokly_sidecar::wire::MethodResult;

use crate::bundle_inputs;
use crate::error::{InternalError, RenderError, Result};
use crate::input_stamp::InputStamp;
use crate::leases::{BundleLease, PreparedLease};
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::{sources, stylesheets};

pub(crate) struct BundleState {
    pub(crate) settings: String,
    pub(crate) lease: Arc<BundleLease>,
    pub(crate) class_maps_digest: String,
    pub(crate) definitions: Definitions,
    pub(crate) modules: BTreeMap<String, Vec<String>>,
    pub(crate) stamp: InputStamp,
}

pub(crate) fn describe(
    runtime: &Runtime,
    config: &ResolvedConfig,
    files: &[SourceFile],
) -> Result<(JavaScriptGeneration, Definitions)> {
    let side = runtime.side(config)?;
    let mut params = bundle_inputs::params(config, files, &side);
    let cache_key = bundle_inputs::cache_key(config, &params, &side)?;
    let candidates: BTreeMap<_, _> = runtime
        .bundles
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .values()
        .filter_map(Weak::upgrade)
        .filter(|state| state.settings == cache_key)
        .map(|state| (state.lease.id.clone(), state))
        .collect();
    let tree = sources::reader(runtime, config, &side);
    let candidates: Vec<_> = candidates
        .into_values()
        .filter(|state| state.stamp.current(tree.as_ref()) == state.stamp)
        .collect();
    let compiler = stylesheets::compiler(runtime, config, &side);
    let mut prepared_maps = None;
    if let Some(previous) = candidates.first() {
        let maps = class_maps(compiler.as_ref(), &previous.modules, &params)?;
        let digest = maps_digest(&maps)?;
        if let Some(existing) = candidates
            .iter()
            .find(|state| state.class_maps_digest == digest)
        {
            return finish(runtime, side, compiler, existing.clone());
        }
        prepared_maps = Some(maps);
    }
    let mut evaluation = cache_key.clone();
    if let Some(maps) = &prepared_maps {
        evaluation.push_str(&maps_digest(maps)?);
    }
    params.evaluation = Some(digest(evaluation.as_bytes()));
    let result = match runtime.pool.request(Call::Bundle(params.clone())) {
        Ok(MethodResult::Bundle(result)) => result,
        Ok(_) => return Err(RenderError::ResultKind { method: "bundle" }),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    let existing = runtime
        .bundles
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&format!("generation:{}", result.generation))
        .and_then(Weak::upgrade);
    if let Some(existing) = existing {
        return finish(runtime, side, compiler, existing);
    }
    let lease = Arc::new(BundleLease {
        id: result.generation,
        pool: runtime.pool.clone(),
    });
    let mut stamp = InputStamp::default();
    for module in result
        .modules
        .iter()
        .filter(|module| !module.path.ends_with(".css"))
    {
        stamp
            .files
            .insert(config.repo_root.join(&module.path), module.digest.clone());
    }
    let modules: BTreeMap<_, _> = result
        .modules
        .into_iter()
        .map(|module| (module.path, module.imports))
        .collect();
    let maps = match prepared_maps {
        Some(maps) => maps,
        None => class_maps(compiler.as_ref(), &modules, &params)?,
    };
    let class_maps_digest = maps_digest(&maps)?;
    match runtime.pool.request(Call::CssModules(CssModules {
        generation: lease.id.clone(),
        class_maps: maps,
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
        generation: lease.id.clone(),
    })) {
        Ok(MethodResult::Definitions(result)) => result,
        Ok(_) => return Err(RenderError::ResultKind { method: "describe" }),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    let state = Arc::new(BundleState {
        settings: cache_key.clone(),
        lease,
        class_maps_digest,
        definitions,
        modules,
        stamp,
    });
    {
        let mut bundles = runtime.bundles.lock().unwrap_or_else(|e| e.into_inner());
        bundles.retain(|_, value| value.strong_count() > 0);
        bundles.insert(cache_key, Arc::downgrade(&state));
        bundles.insert(
            format!("generation:{}", state.lease.id),
            Arc::downgrade(&state),
        );
    }
    finish(runtime, side, compiler, state)
}

fn finish(
    runtime: &Runtime,
    side: SideInputs,
    compiler: Arc<dyn StylesheetBundler>,
    bundle: Arc<BundleState>,
) -> Result<(JavaScriptGeneration, Definitions)> {
    let lease = Arc::new(PreparedLease {
        bundle: bundle.clone(),
        side,
        compiler,
    });
    let mut prepared = runtime.prepared.lock().unwrap_or_else(|e| e.into_inner());
    prepared.retain(|_, value| value.strong_count() > 0);
    prepared.insert(lease.side.context.clone(), Arc::downgrade(&lease));
    Ok((
        JavaScriptGeneration {
            id: bundle.lease.id.clone(),
            class_maps_digest: bundle.class_maps_digest.clone(),
            css_context: lease.side.context.clone(),
            modules: bundle.modules.clone(),
            lease: Some(lease),
        },
        bundle.definitions.clone(),
    ))
}

type ClassMaps = BTreeMap<String, BTreeMap<String, String>>;

fn maps_digest(maps: &ClassMaps) -> Result<String> {
    match serde_json::to_vec(maps) {
        Ok(bytes) => Ok(digest(&bytes)),
        Err(source) => Err(InternalError::Json { source }.into()),
    }
}

fn class_maps(
    compiler: &dyn StylesheetBundler,
    modules: &BTreeMap<String, Vec<String>>,
    params: &Bundle,
) -> Result<ClassMaps> {
    let entries: Vec<_> = params
        .entry_files
        .iter()
        .chain(&params.stories_files)
        .cloned()
        .collect();
    let roots = stylesheets::roots(
        modules,
        params.renderer.as_deref(),
        &entries,
        &params.module_resolution.loaders,
    );
    let mut maps = BTreeMap::new();
    for root in roots {
        match compiler.bundle(&root) {
            Ok(bundle) => maps.extend(bundle.css_modules),
            Err(source) => return Err(RenderError::Css { source }),
        }
    }
    for path in modules.keys().filter(|path| path.ends_with(".module.css")) {
        if !maps.contains_key(path)
            && !stylesheets::ignored(path, &params.module_resolution.loaders)
        {
            let root = StylesheetRoot {
                path: path.clone(),
                stylesheets: vec![path.clone()],
                excluded: Default::default(),
                local_css: true,
            };
            match compiler.bundle(&root) {
                Ok(bundle) => maps.extend(bundle.css_modules),
                Err(source) => return Err(RenderError::Css { source }),
            }
        }
    }
    Ok(maps)
}
