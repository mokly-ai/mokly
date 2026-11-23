//! Bundle only changed JavaScript and isolate class maps across retained graphs.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_model::material::digest;
use mokly_sidecar::compiled::ReuseEvidence;
use mokly_sidecar::definitions::Definitions;
use mokly_sidecar::methods::{BundleCapture, Call, CssModules, Generation};
use mokly_sidecar::results;

use crate::error::{RenderError, Result};
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::render_environment::RenderEnvironment;
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::{
    bundle_attempt, bundle_finish, bundle_inputs, bundle_styles, persistent_identity,
    render_environment,
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
    let compiler = stylesheets::compiler(runtime, config, &side);
    let mut prepared_maps = None;
    if let Some(previous) = candidates.first() {
        let maps = bundle_styles::prepare(compiler.as_ref(), &previous.modules, &params)?;
        let digest = maps.fingerprint();
        if let Some(existing) = candidates
            .iter()
            .find(|state| state.class_maps_digest == digest)
        {
            bundle_attempt::served(runtime, &existing.lease);
            return bundle_finish::finish(runtime, side, compiler, existing.clone());
        }
        prepared_maps = Some(maps);
    }
    let mut evaluation = cache_key.clone();
    if let Some(maps) = &prepared_maps {
        evaluation.push_str(&maps.fingerprint());
    }
    params.evaluation = Some(digest(evaluation.as_bytes()));
    let (mut result, mut lease) = bundle_attempt::request(runtime, &params)?;
    record_usage(runtime, &side, &result);
    let mut modules = bundle_attempt::modules(&result);
    let maps = match prepared_maps {
        Some(maps) => maps,
        None => bundle_styles::prepare(compiler.as_ref(), &modules, &params)?,
    };
    let class_maps_digest = maps.fingerprint();
    if bundle_attempt::existing(runtime, &result.generation)
        .is_some_and(|previous| previous.class_maps_digest != class_maps_digest)
    {
        params.evaluation = Some(digest(format!("{cache_key}{class_maps_digest}").as_bytes()));
        (result, lease) = bundle_attempt::request(runtime, &params)?;
        record_usage(runtime, &side, &result);
        modules = bundle_attempt::modules(&result);
    }
    let mut render = render_environment::derive(
        &params,
        &result,
        &maps.maps,
        runtime
            .base
            .as_ref()
            .map_or(&config.repo_root, |base| &base.working_root),
        runtime
            .base
            .as_ref()
            .and_then(|base| base.cache_namespace.as_deref()),
    );
    render.resolution_digests.extend(maps.inputs);
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
        return bundle_finish::finish(runtime, side, compiler, existing);
    }
    match runtime.pool.request(Call::CssModules(CssModules {
        generation: lease.id.clone(),
        class_maps: maps.maps,
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
    bundle_finish::finish(runtime, side, compiler, state)
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
