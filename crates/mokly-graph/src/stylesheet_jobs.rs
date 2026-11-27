//! Graph preparation bundles each stylesheet root as one render-worker job.

use std::collections::BTreeMap;

use mokly_css::types::{Bundle, OpaqueAsset, StylesheetRoot};

use crate::error::{GraphError, Result};
use crate::graph::Graph;
use crate::imported_assets;
use crate::route_inventory::RouteInventory;
use crate::types::ResourcePlan;
use crate::workers::{StylesheetWorker, check_cancelled};

impl StylesheetWorker for Graph {
    fn stylesheet(&self, root: &StylesheetRoot) -> Result<Bundle> {
        check_cancelled(self.workers.as_ref())?;
        match self.stylesheets.bundle(root) {
            Ok(bundle) => Ok(bundle),
            Err(source) => Err(GraphError::Css { source }),
        }
    }
}

pub(crate) fn register_assets(
    root: &StylesheetRoot,
    assets: BTreeMap<String, OpaqueAsset>,
    names: &mut RouteInventory,
    resources: &mut BTreeMap<String, ResourcePlan>,
) -> Result<()> {
    for (route, asset) in assets {
        imported_assets::register(route, asset, root, names, resources)?;
    }
    Ok(())
}
