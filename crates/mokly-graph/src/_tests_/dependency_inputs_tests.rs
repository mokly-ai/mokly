//! Completed input names map to dependency owners independently of their file suffix.

use std::collections::BTreeMap;

use crate::dependency_inputs::directory;

#[test]
fn bundle_inputs_map_aliases_nested_importers_and_extensionless_stylesheets() {
    let aliases = BTreeMap::from([
        ("node_modules".into(), "node_modules".into()),
        (
            "app/node_modules".into(),
            "node_modules/.mokly-roots/1".into(),
        ),
    ]);
    for (path, expected) in [
        ("node_modules/theme/style", Some("node_modules")),
        ("node_modules/theme/theme.CSS", Some("node_modules")),
        (
            "node_modules/.mokly-roots/1/theme/style",
            Some("app/node_modules"),
        ),
        (
            "packages/ui/node_modules/theme/font.woff2",
            Some("packages/ui/node_modules"),
        ),
        ("specs/local.css", None),
        ("../outside/node_modules/theme.css", None),
        ("node_modules/.mokly-roots/2/theme/style", None),
    ] {
        assert_eq!(directory(path, &aliases).as_deref(), expected, "{path}");
    }
}
