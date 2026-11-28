//! Imported assets share opaque delivery plans, inventory, and route checks with CSS.

use std::collections::BTreeMap;

use mokly_catalogue::preparation::PreparedCatalogue;
use mokly_content_types::imported_content_type;
use mokly_css::paths;
use mokly_css::types::{OpaqueAsset, StylesheetRoot};

use crate::delivery_inputs::ImportedAsset;
use crate::dependency_inputs;
use crate::error::{Result, invalid};
use crate::key::{NodeKind, key};
use crate::route_inventory::RouteInventory;
use crate::types::ResourcePlan;

pub(crate) fn register_imports(
    imports: &[ImportedAsset],
    aliases: &BTreeMap<String, String>,
    catalogue: &mut PreparedCatalogue,
    names: &mut RouteInventory,
    resources: &mut BTreeMap<String, ResourcePlan>,
    imported_by: &mut BTreeMap<String, String>,
) -> Result<()> {
    let mut imports: Vec<_> = imports.iter().collect();
    imports.sort_by_key(|import| (&import.asset.path, &import.module));
    for import in imports {
        let asset = &import.asset;
        let route = paths::route("assets", &asset.path);
        if !paths::portable(&route, true) {
            return Err(invalid(
                &asset.path,
                format!(
                    "asset route is not portable: {}, imported by {}; rename every path segment to be URL-safe (letters, digits, dot, underscore, tilde or hyphen; @scope only after node_modules; no spaces or device names)",
                    asset.path, import.module,
                ),
            ));
        }
        let repository_alias = asset.aliases.iter().any(|path| !dependency(path));
        for path in asset.input_paths() {
            if !dependency(path) || repository_alias {
                catalogue.model.sources.push(path.clone());
            }
            if !repository_alias
                && let Some(directory) = dependency_inputs::directory(path, aliases)
            {
                catalogue.dependency_directories.insert(directory);
            }
            imported_by
                .entry(path.clone())
                .or_insert_with(|| import.module.clone());
        }
        let root = StylesheetRoot {
            path: import.module.clone(),
            stylesheets: Vec::new(),
            excluded: Default::default(),
            local_css: false,
        };
        register(route, asset.clone(), &root, names, resources)?;
    }
    Ok(())
}

fn dependency(path: &str) -> bool {
    path.split('/').any(|part| part == "node_modules")
}

pub(crate) fn register(
    route: String,
    asset: OpaqueAsset,
    root: &StylesheetRoot,
    names: &mut RouteInventory,
    resources: &mut BTreeMap<String, ResourcePlan>,
) -> Result<()> {
    let shared = resources
        .get(&route)
        .and_then(|previous| previous.asset.as_ref())
        .is_some_and(|previous| previous.path == asset.path);
    names.insert(&route, shared)?;
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
            content_type: imported_content_type(&route)
                .unwrap_or("application/octet-stream")
                .into(),
            root: root.clone(),
            asset: Some(asset),
        });
    Ok(())
}
