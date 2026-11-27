//! Retain the prepared side and expose its immutable rendering identity.

use std::collections::BTreeSet;
use std::sync::Arc;

use mokly_catalogue::render_sources::JavaScriptGeneration;
use mokly_sidecar::definitions::Definitions;

use crate::bundle::BundleState;
use crate::error::Result;
use crate::leases::{ContextLease, PreparedLease};
use crate::runtime::Runtime;
use crate::side::SideInputs;
use crate::stylesheet_compiler::StylesheetPreparation;

pub(crate) fn finish(
    runtime: &Runtime,
    side: SideInputs,
    compiler: Arc<dyn StylesheetPreparation>,
    context: Option<Arc<ContextLease>>,
    bundle: Arc<BundleState>,
) -> Result<(JavaScriptGeneration, Definitions)> {
    if let Some(env) = &runtime.vite_base_env {
        env.record(&bundle.stamp.vite_env);
    }
    let lease = Arc::new(PreparedLease {
        bundle: bundle.clone(),
        side,
        compiler,
        context,
    });
    let mut prepared = runtime.prepared.lock().unwrap_or_else(|e| e.into_inner());
    prepared.retain(|_, value| value.strong_count() > 0);
    prepared.insert(lease.side.context.clone(), Arc::downgrade(&lease));
    Ok((
        JavaScriptGeneration {
            persistence_identity: bundle.persistence_identity.clone(),
            id: bundle.lease.id.clone(),
            class_maps_digest: bundle.class_maps_digest.clone(),
            css_context: lease.side.context.clone(),
            modules: bundle.modules.clone(),
            package_imports: bundle.package_imports.clone(),
            module_digests: bundle.module_digests.clone(),
            imported_assets: bundle.imported_assets.clone(),
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
                .chain(
                    bundle
                        .stamp
                        .vite_env
                        .iter()
                        .filter(|input| input.render)
                        .map(|input| input.name.clone()),
                )
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
