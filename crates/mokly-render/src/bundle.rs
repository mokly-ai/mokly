//! Bundle only changed JavaScript and isolate class maps across retained graphs.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Weak};
use std::thread;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_css::types::StylesheetRoot;
use mokly_model::material::digest;
use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{Bundle, BundleCapture, Call, CssModules, Generation};
use mokly_sidecar::results;

use crate::error::{RenderError, Result};
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::render_environment::{ClassMaps, RenderEnvironment};
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::stylesheet_class_maps::ClassMapCompiler;
use crate::{
    bundle_attempt, bundle_finish, bundle_inputs, persistent_identity, render_environment,
};
use crate::{physical_inputs, sources, stylesheets};

pub(crate) struct BundleState {
    pub(crate) persistence_identity: Option<String>,
    pub(crate) repository: PathBuf,
    pub(crate) settings: String,
    pub(crate) lease: Arc<BundleLease>,
    pub(crate) class_maps_digest: String,
    pub(crate) definitions: Definitions,
    pub(crate) modules: BTreeMap<String, Vec<String>>,
    pub(crate) module_digests: BTreeMap<String, Option<String>>,
    pub(crate) render: RenderEnvironment,
    pub(crate) stamp: InputStamp,
    pub(crate) toolchain: String,
    pub(crate) reuse_evidence: Arc<ReuseEvidence>,
}

pub(crate) fn describe(
    runtime: &Runtime,
    config: &ResolvedConfig,
    files: &[SourceFile],
) -> Result<(JavaScriptGeneration, Definitions)> {
    let side = runtime.side(config);
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
    let mut candidates: Vec<_> = candidates
        .into_values()
        .filter(|state| {
            state.stamp.matches(tree.as_ref())
                && (physical_inputs::current(
                    &state.reuse_evidence,
                    runtime.physical_inputs.as_ref(),
                ) || runtime.bundle_capture == BundleCapture::ServeEdit
                    && !state.toolchain.is_empty()
                    && physical_inputs::marked_current(
                        &state.reuse_evidence,
                        runtime.physical_inputs.as_ref(),
                    ))
        })
        .collect();
    candidates.sort_by_key(|state| !state.reuse_evidence.captured());
    let attempt = stylesheets::attempt(runtime, config, &side);
    let compiler = attempt.compiler;
    let context = attempt.context;
    let mut prepared_maps = None;
    if let Some(previous) = candidates.first() {
        let maps = class_maps(compiler.as_ref(), &previous.modules, &params)?;
        let digest = maps_digest(&maps);
        if let Some(existing) = candidates
            .iter()
            .find(|state| state.class_maps_digest == digest)
        {
            bundle_attempt::served(runtime, &existing.lease);
            return bundle_finish::finish(runtime, side, compiler, context, existing.clone());
        }
        prepared_maps = Some(maps);
    }
    let mut evaluation = cache_key.clone();
    if let Some(maps) = &prepared_maps {
        evaluation.push_str(&maps_digest(maps));
    }
    params.evaluation = Some(digest(evaluation.as_bytes()));
    let preparation = if runtime.bundle_capture == BundleCapture::ServeEdit
        && runtime.base.is_none()
        && runtime.head_styles.is_none()
    {
        context
            .as_ref()
            .filter(|lease| {
                !lease.used.load(Ordering::Relaxed)
                    && !runtime.older_used_head_context(lease)
                    && compiler.stale_postcss()
            })
            .and_then(|lease| config.postcss().and_then(|postcss| lease.prepare(postcss)))
    } else {
        None
    };
    let (mut result, mut lease) = bundle_attempt::request(runtime, &params, preparation)?;
    record_usage(runtime, &side, &result);
    let mut modules = bundle_attempt::modules(&result);
    let maps = match prepared_maps {
        Some(maps) => maps,
        None => class_maps(compiler.as_ref(), &modules, &params)?,
    };
    let class_maps_digest = maps_digest(&maps);
    if bundle_attempt::existing(runtime, &result.generation)
        .is_some_and(|previous| previous.class_maps_digest != class_maps_digest)
    {
        params.evaluation = Some(digest(format!("{cache_key}{class_maps_digest}").as_bytes()));
        (result, lease) = bundle_attempt::request(runtime, &params, None)?;
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
    );
    let stamp = bundle_attempt::stamp(&result, &config.repo_root);
    let module_digests = result
        .modules
        .iter()
        .map(|module| (module.path.clone(), module.digest.clone()))
        .collect();
    if let Some(existing) = bundle_attempt::existing(runtime, &result.generation) {
        let existing = Arc::new(BundleState {
            persistence_identity: persistent_identity::compilation(&result.compiled),
            repository: config.repo_root.clone(),
            settings: cache_key,
            lease: existing.lease.clone(),
            class_maps_digest,
            definitions: existing.definitions.clone(),
            modules,
            module_digests,
            render,
            stamp,
            toolchain: result.compiled.toolchain.clone(),
            reuse_evidence: result.compiled.reuse_evidence.clone(),
        });
        bundle_attempt::remember(runtime, &existing);
        return bundle_finish::finish(runtime, side, compiler, context, existing);
    }
    match runtime.pool.request(Call::CssModules(CssModules {
        generation: lease.id.clone(),
        class_maps: maps,
    })) {
        Ok(_) => {}
        Err(source) => return Err(RenderError::Sidecar { source }),
    }
    let definitions = match runtime.pool.request(Call::Describe(Generation {
        generation: lease.id.clone(),
    })) {
        Ok(result) => result.into_definitions(),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    let state = Arc::new(BundleState {
        persistence_identity: persistent_identity::compilation(&result.compiled),
        repository: config.repo_root.clone(),
        settings: cache_key.clone(),
        lease,
        class_maps_digest,
        definitions,
        modules,
        module_digests,
        render,
        stamp,
        toolchain: result.compiled.toolchain.clone(),
        reuse_evidence: result.compiled.reuse_evidence.clone(),
    });
    bundle_attempt::remember(runtime, &state);
    bundle_finish::finish(runtime, side, compiler, context, state)
}

fn maps_digest(maps: &ClassMaps) -> String {
    let bytes = serde_json::to_vec(maps)
        .expect("CSS Modules maps contain only strings and string-keyed maps");
    digest(&bytes)
}

fn class_maps(
    compiler: &dyn ClassMapCompiler,
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
    let parallelism = thread::available_parallelism().map_or(1, usize::from);
    let mut maps = match compiler.class_maps(&roots, parallelism) {
        Ok(maps) => maps,
        Err(source) => return Err(RenderError::Css { source }),
    };
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
    for module in result.modules.iter() {
        runtime
            .dependency_usage
            .record(&side.dependency_aliases, &module.path);
    }
}

#[cfg(test)]
#[path = "_tests_/class_maps/uncovered_tests.rs"]
mod uncovered_tests;
