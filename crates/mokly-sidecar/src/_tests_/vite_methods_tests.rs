//! Optional Vite settings preserve the default bundle wire representation.

use serde_json::json;

use crate::methods::Bundle;

#[test]
fn default_bundle_serialization_omits_vite_and_true_round_trips() {
    let original = json!({
        "entryFiles": ["entry.ts"], "renderer": null, "storiesFiles": [],
        "moduleResolution": {"aliases": {}, "conditions": [], "loaders": {},
            "mainFields": [], "packageRoots": [], "resolveExtensions": []},
        "sourceRoot": "/repo", "configurationDirectory": ".", "repositoryRoots": []
    });
    let params: Bundle = serde_json::from_value(original.clone()).unwrap();
    assert_eq!(
        serde_json::to_string(&params).unwrap(),
        original.to_string()
    );
    assert_eq!(serde_json::to_value(params).unwrap(), original);
    let mut enabled = original.clone();
    enabled["vite"] = true.into();
    let params: Bundle = serde_json::from_value(enabled.clone()).unwrap();
    assert_eq!(serde_json::to_value(params).unwrap(), enabled);
    enabled["vite"] = false.into();
    let params: Bundle = serde_json::from_value(enabled).unwrap();
    assert_eq!(serde_json::to_value(params).unwrap(), original);
}
