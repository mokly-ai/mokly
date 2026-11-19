//! Captured plan references fail at the typed response boundary.

use serde_json::json;

use crate::compiled_fixture::compiled;
use crate::error::{Error, ProtocolError};
use crate::wire::{Request, Response};

#[test]
fn a_bundle_result_rejects_import_indices_outside_its_path_table() {
    let request: Request = serde_json::from_value(json!({
        "id": 1,
        "method": "bundle",
        "params": {
            "entryFiles": [], "renderer": null, "storiesFiles": [],
            "moduleResolution": {}, "sourceRoot": "/repo",
            "configurationDirectory": ".", "repositoryRoots": []
        }
    }))
    .unwrap();
    for (name, importer, target) in [("importer", 2, 1), ("target", 0, 2)] {
        let response: Response = serde_json::from_str(
            &json!({
                "id": 1,
                "result": {
                    "generation": "g", "modules": [], "compiled": compiled("g"),
                    "plan": {
                        "paths": ["/repo/entry.ts", "/repo/value.ts"],
                        "imports": [[importer, "./value.ts", "import-statement", target, true]]
                    }
                }
            })
            .to_string(),
        )
        .unwrap();
        assert!(
            matches!(
                response.decode_result(&request),
                Err(Error::Protocol(ProtocolError::Json { .. }))
            ),
            "out-of-range {name} must reject the result"
        );
    }
}

#[test]
fn a_bundle_result_rejects_invalid_directory_selectors() {
    let request: Request = serde_json::from_value(json!({
        "id": 1, "method": "bundle", "params": {
            "entryFiles": [], "renderer": null, "storiesFiles": [],
            "moduleResolution": {}, "sourceRoot": "/repo",
            "configurationDirectory": ".", "repositoryRoots": []
        }
    }))
    .unwrap();
    for (name, candidates) in [
        ("reference", json!([[1, ["value.ts"]]])),
        ("duplicate directory", json!([[0, ["a"]], [0, ["b"]]])),
        ("uppercase", json!([[0, ["Value.ts"]]])),
        ("unicode", json!([[0, ["Key.ts"]]])),
        ("order", json!([[0, ["b", "a"]]])),
        ("duplicate name", json!([[0, ["a", "a"]]])),
        ("separator", json!([[0, ["a/b"]]])),
    ] {
        let response: Response = serde_json::from_value(json!({
            "id": 1, "result": {
                "generation": "g", "modules": [], "compiled": compiled("g"),
                "plan": {"paths": ["/repo"], "imports": [], "candidates": candidates}
            }
        }))
        .unwrap();
        assert!(
            matches!(
                response.decode_result(&request),
                Err(Error::Protocol(ProtocolError::Json { .. }))
            ),
            "{name}"
        );
    }
}
