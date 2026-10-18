//! Stylesheet work depends on private inputs; documents depend on delivered output.

use std::collections::BTreeMap;

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_model::material::digest;
use serde_json::json;

use crate::error::Result;
use crate::key::{NodeKey, NodeKind, data_key, key};

pub(crate) fn input(config: &NodeKey, root: &StylesheetRoot, bundle: &Bundle) -> Result<NodeKey> {
    let mut inputs: BTreeMap<_, _> = bundle
        .inputs
        .iter()
        .map(|(path, bytes)| (path, digest(bytes)))
        .collect();
    for asset in bundle.assets.values() {
        for path in asset.input_paths() {
            inputs.insert(path, asset.digest.clone());
        }
    }
    let paths: Vec<_> = inputs
        .iter()
        .map(|(path, hash)| format!("{path}:{hash}"))
        .chain(
            bundle
                .dependency_digests
                .iter()
                .map(|(path, hash)| format!("{path}:{hash}")),
        )
        .collect();
    let recipe = data_key(
        NodeKind::Stylesheet,
        json!({
            "path":root.path, "stylesheets":root.stylesheets, "excluded":root.excluded, "localCss":root.local_css
        }),
    )?;
    let mut inputs = vec![config.0.as_bytes(), recipe.0.as_bytes()];
    inputs.extend(paths.iter().map(|key| key.as_bytes()));
    Ok(key(NodeKind::Stylesheet, &inputs))
}

pub(crate) fn output(bundle: &Bundle) -> NodeKey {
    let assets: Vec<_> = bundle
        .assets
        .iter()
        .map(|(path, asset)| format!("{path}:{}", asset.digest))
        .collect();
    let mut inputs = vec![bundle.route.as_bytes(), bundle.css.as_bytes()];
    inputs.extend(assets.iter().map(|value| value.as_bytes()));
    key(NodeKind::Stylesheet, &inputs)
}
