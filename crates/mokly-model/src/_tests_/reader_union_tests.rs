//! Known fields cannot move between variants in either public reader mode.

use serde_json::{Value, json};

use crate::readers::reader_fixtures;
use crate::readers::{self, ReadError};

#[test]
fn index_modes_reject_fields_from_other_record_variants() {
    for (pointer, field) in [
        ("/tree/2", "title"),
        ("/tree/2", "index"),
        ("/screens/0/changes", "included"),
        ("/screens/0/changes", "kind"),
        ("/screens/0/views/0/comparison", "eligible"),
        ("/screens/0/views/0/comparison", "kind"),
        ("/components/0/controls/label", "minimum"),
        ("/components/0/controls/disabled", "maxLength"),
        ("/components/0/controls/count", "options"),
        ("/components/0/controls/tone", "step"),
        ("/screens/0", "slots"),
        ("/components/0", "address"),
        ("/pages/0", "views"),
        ("/documents/0", "props"),
        ("/useCases/0", "documentKey"),
        ("/removedEntries/0/entry", "slots"),
    ] {
        for supplied in [Value::Null, json!([])] {
            let mut value = reader_fixtures::index();
            if pointer.ends_with("changes") || pointer.ends_with("comparison") {
                *value.pointer_mut(pointer).unwrap() = json!({"status":"pending"});
            }
            value.pointer_mut(pointer).unwrap()[field] = supplied;
            for result in [
                readers::index(&value.to_string()),
                readers::index_lenient(&value.to_string()),
            ] {
                assert!(
                    matches!(
                        result,
                        Err(ReadError::Invalid {
                            boundary: "catalogue index",
                            ..
                        })
                    ),
                    "{pointer}/{field}: {result:?}"
                );
            }
        }
    }
}

#[test]
fn detail_modes_reject_fields_from_other_record_variants() {
    for (pointer, field) in [
        ("/views/0/usage", "ranges"),
        ("/views/0/usage/instances/0/owner", "instanceKey"),
        ("/views/0/usage/ranges/0/target", "slotKey"),
        ("/views/0/usage/ranges/1/target", "instanceKey"),
        ("/views/0/resourceEvidence/resources/0/owner", "path"),
        ("/reasons/0", "screenPath"),
        ("/reasons/1", "path"),
    ] {
        for supplied in [Value::Null, json!([])] {
            let mut value = reader_fixtures::detail("product/browse/home");
            if pointer == "/views/0/usage" {
                *value.pointer_mut(pointer).unwrap() = json!({"status":"pending"});
            }
            value.pointer_mut(pointer).unwrap()[field] = supplied;
            for result in [
                readers::detail(&value.to_string()),
                readers::detail_lenient(&value.to_string()),
            ] {
                assert!(
                    matches!(
                        result,
                        Err(ReadError::Invalid {
                            boundary: "entry detail",
                            ..
                        })
                    ),
                    "{pointer}/{field}: {result:?}"
                );
            }
        }
    }
    let mut page = reader_fixtures::detail("guide");
    page["resourceEvidence"]["rules"][0]["owner"]["path"] = Value::Null;
    assert!(matches!(
        readers::detail_lenient(&page.to_string()),
        Err(ReadError::Invalid { .. })
    ));
}

#[test]
fn lenient_readers_reject_unknown_record_discriminants() {
    for pointer in [
        "/tree/0/kind",
        "/removedEntries/0/preview/kind",
        "/screens/0/kind",
        "/screens/0/changes/status",
        "/screens/0/views/0/comparison/status",
        "/components/0/controls/label/kind",
    ] {
        let mut value = reader_fixtures::index();
        *value.pointer_mut(pointer).unwrap() = json!("later");
        assert!(
            matches!(
                readers::index_lenient(&value.to_string()),
                Err(ReadError::Invalid { .. })
            ),
            "{pointer}"
        );
    }
    for pointer in [
        "/views/0/usage/status",
        "/views/0/usage/instances/0/owner/kind",
        "/views/0/usage/ranges/0/target/kind",
        "/views/0/resourceEvidence/rules/0/owner/kind",
        "/reasons/0/kind",
    ] {
        let mut value = reader_fixtures::detail("product/browse/home");
        *value.pointer_mut(pointer).unwrap() = json!("later");
        assert!(
            matches!(
                readers::detail_lenient(&value.to_string()),
                Err(ReadError::Invalid { .. })
            ),
            "{pointer}"
        );
    }
}
