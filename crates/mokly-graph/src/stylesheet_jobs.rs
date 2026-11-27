//! Graph preparation bundles each stylesheet root as one render-worker job.

use std::collections::BTreeMap;

use mokly_css::paths;
use mokly_css::types::{Bundle, OpaqueAsset, StylesheetRoot};

use crate::error::{GraphError, Result, invalid};
use crate::graph::Graph;
use crate::key::{NodeKind, key};
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
        names.insert(&route, true)?;
        let asset_key = key(
            NodeKind::Stylesheet,
            &[route.as_bytes(), asset.digest.as_bytes()],
        );
        if resources
            .get(&route)
            .is_some_and(|previous| previous.key != asset_key)
        {
            return Err(invalid(
                &route,
                format!(
                    "CSS asset bytes disagree at {route}; keep shared asset inputs stable during the build"
                ),
            ));
        }
        resources
            .entry(route.clone())
            .or_insert_with(|| ResourcePlan {
                document_key: asset_key.clone(),
                key: asset_key,
                content_type: paths::content_type(&route)
                    .unwrap_or("application/octet-stream")
                    .into(),
                root: root.clone(),
                asset: Some(asset),
            });
    }
    Ok(())
}
