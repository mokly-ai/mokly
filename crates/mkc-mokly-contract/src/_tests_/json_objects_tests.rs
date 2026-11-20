//! Protocol structs require object syntax, including the index's read fields.

use serde_json::{Value, json};

use crate::error::{Error, Rejection};
use crate::index::CatalogueIndex;
use crate::inventory::Inventory;
use crate::limits::Limits;
use crate::manifest::UploadManifest;

fn array(value: &Value, keys: &[&str]) -> Value {
    json!(
        keys.iter()
            .map(|key| value[key].clone())
            .collect::<Vec<_>>()
    )
}

#[test]
fn root_array_forms_are_invalid_before_version_classification() {
    for bytes in [b"[4]".as_slice(), b"[6]", b"[3]", b"[9]", b"[]"] {
        for error in [
            UploadManifest::parse(bytes, Limits::default()).unwrap_err(),
            Inventory::parse(bytes, Limits::default()).unwrap_err(),
            CatalogueIndex::parse(bytes, Limits::default()).unwrap_err(),
        ] {
            assert!(
                matches!(error, Error::Invalid { .. }),
                "{bytes:?}: {error:?}"
            );
            assert_eq!(error.status_code(), 400);
        }
    }
}

#[test]
fn envelopes_and_marker_entries_refuse_positional_arrays() {
    let mut envelope: Value =
        serde_json::from_slice(include_bytes!("../../fixtures/mokly-upload.json")).unwrap();
    envelope["repository"] = array(&envelope["repository"], &["host", "owner", "name"]);
    assert_eq!(
        UploadManifest::parse(&serde_json::to_vec(&envelope).unwrap(), Limits::default())
            .unwrap_err()
            .status_code(),
        400
    );
    let entry = json!(["index.html", "a".repeat(64), 1]);
    let marker = json!({"schemaVersion":3,"files":[entry]});
    assert_eq!(
        Inventory::parse(&serde_json::to_vec(&marker).unwrap(), Limits::default())
            .unwrap_err()
            .status_code(),
        400
    );
}

#[test]
fn indexes_refuse_array_forms_of_read_objects() {
    let original: Value =
        serde_json::from_slice(include_bytes!("../../fixtures/catalogue-v9.json")).unwrap();
    for (pointer, keys) in [
        ("/screens/0", vec!["path", "title", "changes", "views"]),
        ("/screens/0/views/0", vec!["viewport", "colorScheme"]),
        ("/screens/0/changes", vec!["status", "kind", "included"]),
        ("/removedEntries/0", vec!["entry"]),
        ("/removedEntries/0/entry", vec!["path", "title", "changes"]),
    ] {
        let mut document = original.clone();
        let object = document.pointer_mut(pointer).unwrap();
        *object = array(object, &keys);
        assert!(
            matches!(
                CatalogueIndex::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()),
                Err(Error::Invalid {
                    reason: Rejection::Json
                })
            ),
            "{pointer}"
        );
    }
}

#[test]
fn numeric_tags_cannot_select_enum_variant_indexes() {
    let original: Value =
        serde_json::from_slice(include_bytes!("../../fixtures/catalogue-v9.json")).unwrap();
    for pointer in [
        "/changesStatus",
        "/screens/0/changes/status",
        "/screens/0/changes/kind",
        "/screens/0/views/0/viewport",
        "/screens/0/views/0/colorScheme",
    ] {
        let mut document = original.clone();
        *document.pointer_mut(pointer).unwrap() = json!(0);
        assert!(
            matches!(
                CatalogueIndex::parse(&serde_json::to_vec(&document).unwrap(), Limits::default()),
                Err(Error::Invalid {
                    reason: Rejection::Json
                })
            ),
            "{pointer}"
        );
    }
}
