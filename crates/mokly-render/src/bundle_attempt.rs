//! Bundle requests retain every epoch while source stamps track equivalent compilations.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Weak};

use mokly_sidecar::methods::{Bundle, Call};
use mokly_sidecar::results;
use mokly_sidecar::wire::MethodResult;

use crate::bundle::BundleState;
use crate::error::{RenderError, Result};
use crate::input_stamp::InputStamp;
use crate::leases::BundleLease;
use crate::runtime::Runtime;

/// Request a bundle and immediately own its returned lifetime epoch.
pub(crate) fn request(
    runtime: &Runtime,
    params: &Bundle,
) -> Result<(results::Bundle, Arc<BundleLease>)> {
    let result = match runtime.pool.request(Call::Bundle(params.clone())) {
        Ok(MethodResult::Bundle(result)) => result,
        Ok(_) => return Err(RenderError::ResultKind { method: "bundle" }),
        Err(source) => return Err(RenderError::Sidecar { source }),
    };
    let lease = Arc::new(BundleLease {
        epoch: result.epoch,
        id: result.generation.clone(),
        pool: runtime.pool.clone(),
    });
    Ok((result, lease))
}
/// Find a retained evaluated state without extending the registry lifetime.
pub(crate) fn existing(runtime: &Runtime, id: &str) -> Option<Arc<BundleState>> {
    runtime
        .bundles
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&format!("generation:{id}"))
        .and_then(Weak::upgrade)
}
/// Keep weak lookup entries for the latest equivalent compilation stamp.
pub(crate) fn remember(runtime: &Runtime, bundle: &Arc<BundleState>) {
    let mut bundles = runtime.bundles.lock().unwrap_or_else(|e| e.into_inner());
    bundles.retain(|_, value| value.strong_count() > 0);
    bundles.insert(bundle.settings.clone(), Arc::downgrade(bundle));
    bundles.insert(
        format!("generation:{}", bundle.lease.id),
        Arc::downgrade(bundle),
    );
}
/// Retain one module graph outside the compiled program payload.
pub(crate) fn modules(result: &results::Bundle) -> BTreeMap<String, Vec<String>> {
    result
        .modules
        .iter()
        .map(|module| (module.path.clone(), module.imports.clone()))
        .collect()
}
/// Capture every compiler digest and direct directory membership.
pub(crate) fn stamp(result: &results::Bundle, repository: &Path) -> InputStamp {
    let mut stamp = InputStamp::default();
    if let Some(compiled) = &result.compiled {
        stamp
            .memberships
            .extend(compiled.metadata_directories.iter().map(|(path, names)| {
                (
                    repository.join(path),
                    Some(names.iter().map(PathBuf::from).collect()),
                )
            }));
        stamp.files.extend(
            compiled
                .metadata_inputs
                .iter()
                .map(|(path, hash)| (repository.join(path), hash.clone())),
        );
    }
    for module in result
        .modules
        .iter()
        .filter(|module| !module.path.ends_with(".css"))
    {
        stamp
            .files
            .insert(repository.join(&module.path), module.digest.clone());
    }
    stamp
}
