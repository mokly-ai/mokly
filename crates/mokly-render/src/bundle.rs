//! Bundle only changed JavaScript and isolate class maps across retained graphs.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_css::types::{StylesheetBundler, StylesheetRoot};
use mokly_model::material::digest;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{Bundle, Call, CssModules, Generation};
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;

use crate::error::{InternalError, RenderError, Result};
use crate::input_stamp::InputStamp;
use crate::leases::{BundleLease, PreparedLease};
use crate::render_environment::{ClassMaps, RenderEnvironment};
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::{bundle_attempt, bundle_inputs, render_environment};
use crate::{sources, stylesheets};

pub(crate) struct BundleState {
    pub(crate) repository: PathBuf,
    pub(crate) settings: String,
    pub(crate) lease: Arc<BundleLease>,
    pub(crate) class_maps_digest: String,
    pub(crate) definitions: Definitions,
    pub(crate) modules: BTreeMap<String, Vec<String>>,
    pub(crate) module_digests: BTreeMap<String, Option<String>>,
    pub(crate) render: RenderEnvironment,
    pub(crate) stamp: InputStamp,
}

pub(crate) fn describe(
    runtime: &Runtime,
    config: &ResolvedConfig,
    files: &[SourceFile],
) -> Result<(JavaScriptGeneration, Definitions)> {
    let side = runtime.side(config)?;
    let mut params = bundle_inputs::params(config, files, &side);
    let cache_key =
        bundle_inputs::cache_key(config, &params, &side, runtime.dependency_tree.as_ref())?;
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
    let (mut result, mut lease) = bundle_attempt::request(runtime, &params)?;
    record_usage(runtime, &side, &result);
    let mut modules = bundle_attempt::modules(&result);
    let maps = match prepared_maps {
        Some(maps) => maps,
        None => class_maps(compiler.as_ref(), &modules, &params)?,
    };
    let class_maps_digest = maps_digest(&maps)?;
    if bundle_attempt::existing(runtime, &result.generation)
        .is_some_and(|previous| previous.class_maps_digest != class_maps_digest)
    {
        params.evaluation = Some(digest(format!("{cache_key}{class_maps_digest}").as_bytes()));
        (result, lease) = bundle_attempt::request(runtime, &params)?;
        record_usage(runtime, &side, &result);
        modules = bundle_attempt::modules(&result);
    }
    let render = render_environment::derive(
        &params,
        &result,
        &maps,
        runtime
            .base
            .as_ref()
            .map_or(&config.repo_root, |base| &base.working_root),
        runtime
            .base
            .as_ref()
            .and_then(|base| base.cache_namespace.as_deref()),
    )?;
    let stamp = bundle_attempt::stamp(&result, &config.repo_root);
    let module_digests = result
        .modules
        .iter()
        .map(|module| (module.path.clone(), module.digest.clone()))
        .collect();
    if let Some(existing) = bundle_attempt::existing(runtime, &result.generation) {
        let existing = Arc::new(BundleState {
            repository: config.repo_root.clone(),
            settings: cache_key,
            lease: existing.lease.clone(),
            class_maps_digest,
            definitions: existing.definitions.clone(),
            modules,
            module_digests,
            render,
            stamp,
        });
        bundle_attempt::remember(runtime, &existing);
        return finish(runtime, side, compiler, existing);
    }
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
        repository: config.repo_root.clone(),
        settings: cache_key.clone(),
        lease,
        class_maps_digest,
        definitions,
        modules,
        module_digests,
        render,
        stamp,
    });
    bundle_attempt::remember(runtime, &state);
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
            module_digests: bundle.module_digests.clone(),
            environment: bundle.render.environment.clone(),
            resolution_digests: bundle.render.resolution_digests.clone(),
            class_map_digests: bundle.render.class_map_digests.clone(),
            runtime_packages: bundle.render.runtime_packages.clone(),
            unattributed: BTreeSet::new(),
            resolution_files: bundle
                .stamp
                .files
                .keys()
                .filter_map(|path| {
                    path.strip_prefix(&bundle.repository)
                        .ok()
                        .map(|path| path.to_string_lossy().replace('\\', "/"))
                })
                .collect(),
            resolution_directories: bundle
                .stamp
                .memberships
                .iter()
                .filter_map(|(path, names)| {
                    path.strip_prefix(&bundle.repository).ok().map(|path| {
                        (
                            path.to_string_lossy().replace('\\', "/"),
                            names
                                .iter()
                                .flatten()
                                .map(|name| name.to_string_lossy().into_owned())
                                .collect(),
                        )
                    })
                })
                .collect(),
            lease: Some(lease),
        },
        bundle.definitions.clone(),
    ))
}

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

fn record_usage(runtime: &Runtime, side: &SideInputs, result: &results::Bundle) {
    for directory in result.unmapped_dependency_directories.iter().flatten() {
        runtime.dependency_usage.unmapped(directory);
    }
    for module in &result.modules {
        runtime
            .dependency_usage
            .record(&side.dependency_aliases, &module.path);
    }
}
