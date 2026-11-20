//! Each bundle delivery maps logical JavaScript watches with its current side inputs.

use std::collections::{BTreeMap, BTreeSet};

use mokly_css::watch_inputs::WatchInputs;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_source_interface::tree::SourceTree;

use crate::bundle::BundleState;
use crate::error::{InternalError, Result};
use crate::resolution_watch::{self, Projection};
use crate::runtime::Runtime;
use crate::side::SideInputs;

#[derive(Default)]
pub(crate) struct Resolution {
    pub(crate) inputs: WatchInputs,
    pub(crate) directories: BTreeMap<String, BTreeSet<String>>,
}

pub(crate) fn inputs(
    runtime: &Runtime,
    side: &SideInputs,
    bundle: &BundleState,
) -> Result<Resolution> {
    if !runtime.watch_resolution {
        return Ok(Resolution::default());
    }
    let sources = SourceSnapshot::new(runtime.inventory_tree.clone());
    let logical = bundle
        .stamp
        .files
        .keys()
        .chain(bundle.stamp.memberships.keys())
        .filter_map(|path| path.strip_prefix(&bundle.repository).ok())
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .collect();
    let projection = mapped(&sources, side, bundle, &logical)?;
    let mut directories: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for (path, names) in &bundle.stamp.memberships {
        let Ok(path) = path.strip_prefix(&bundle.repository) else {
            continue;
        };
        let logical = path.to_string_lossy().replace('\\', "/");
        for path in projection.paths.get(&logical).into_iter().flatten() {
            directories.entry(path.clone()).or_default().extend(
                names
                    .iter()
                    .flatten()
                    .map(|name| name.to_string_lossy().into_owned()),
            );
        }
    }
    Ok(Resolution {
        inputs: projection.inputs,
        directories,
    })
}

fn mapped(
    sources: &dyn SourceTree,
    side: &SideInputs,
    bundle: &BundleState,
    logical: &BTreeSet<String>,
) -> Result<Projection> {
    match resolution_watch::inputs(logical, &bundle.repository, side, sources) {
        Ok(inputs) => Ok(inputs),
        Err(source) => Err(InternalError::Source { source }.into()),
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_watch_tests.rs"]
mod bundle_watch_tests;
