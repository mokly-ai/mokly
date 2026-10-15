//! Stylesheet work depends on private inputs; documents depend on delivered output.

use mokly_css::types::{Bundle, StylesheetRoot};
use mokly_model::material::digest;
use serde_json::json;

use crate::error::Result;
use crate::key::{NodeKey, NodeKind, data_key, key};

pub(crate) fn input(config: &NodeKey, root: &StylesheetRoot, bundle: &Bundle) -> Result<NodeKey> {
    let paths: Vec<_> = bundle
        .inputs
        .iter()
        .map(|(path, bytes)| format!("{path}:{}", digest(bytes)))
        .chain(
            bundle
                .dependency_digests
                .iter()
                .map(|(path, digest)| format!("{path}:{digest}")),
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
        .map(|(path, bytes)| format!("{path}:{}", digest(bytes)))
        .collect();
    let mut inputs = vec![bundle.route.as_bytes(), bundle.css.as_bytes()];
    inputs.extend(assets.iter().map(|value| value.as_bytes()));
    key(NodeKind::Stylesheet, &inputs)
}
