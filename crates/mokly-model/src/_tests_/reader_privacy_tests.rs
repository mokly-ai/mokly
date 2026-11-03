//! Lenient receivers inspect extensions before discarding unknown fields.

use serde_json::{Value, json};

use crate::read_contract::ContractViolation;
use crate::readers::reader_fixtures;
use crate::readers::{self, ReadError};

#[test]
fn lenient_receivers_reject_private_keys_inside_unknown_extensions() {
    for key in [
        "dependencies",
        "sourceFiles",
        "movedFrom",
        "declaredDependencies",
        "ownedDependencies",
        "startOffset",
        "endOffset",
        "styles",
        "resources",
        "manifest",
        "baseline",
        "changedPaths",
        "headDigests",
        "sourceGraph",
        "renderCapability",
        "resolvedDependencies",
        "dependencyEvidence",
        "baselineManifest",
        "sourceMaps",
        "gitCommands",
        "styleOwnership",
        "resourceOwnership",
        "credentials",
        "token",
        "authorization",
        "cookies",
        "usage",
        "resourceEvidence",
    ] {
        let mut value = reader_fixtures::index();
        value["later"] = json!({"nested":[{key:[]}]});
        assert!(
            matches!(
                readers::index_lenient(&value.to_string()),
                Err(ReadError::Contract {
                    boundary: "catalogue index",
                    message: ContractViolation::PrivateField
                })
            ),
            "{key}"
        );
    }
    for pointer in ["/later", "/views/0/resourceEvidence/later"] {
        let mut value = reader_fixtures::detail("product/browse/home");
        let (parent, field) = pointer.rsplit_once('/').unwrap();
        value.pointer_mut(parent).unwrap()[field] = json!({"nested":[{"token":"secret"}]});
        assert!(
            matches!(
                readers::detail_lenient(&value.to_string()),
                Err(ReadError::Contract {
                    message: ContractViolation::PrivateField,
                    ..
                })
            ),
            "{pointer}"
        );
    }
    let mut value = reader_fixtures::detail("guide");
    value["resources"] = json!([]);
    assert!(matches!(
        readers::detail_lenient(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::PrivateField,
            ..
        })
    ));
}

#[test]
fn privacy_preserves_authored_data_names_but_checks_map_record_values() {
    let mut value = reader_fixtures::index();
    value["later"] = json!({"properties":{"token":{"later":1},"constructor":{"later":1}},
        "controls":{"sourcePath":{"later":1}},
        "props":{"token":"secret","sourcePath":"../data"},
        "before":{"cookies":[],"path":"/data"},"after":{"resources":[],"path":"C:data"}});
    let read = readers::index_lenient(&value.to_string()).unwrap();
    let mut expected = value.clone();
    expected.as_object_mut().unwrap().remove("later");
    assert_eq!(serde_json::to_value(read).unwrap(), expected);
    for map in ["properties", "controls"] {
        let mut invalid = value.clone();
        invalid["later"][map]["token"] = json!({"token":"secret"});
        assert!(
            matches!(
                readers::index_lenient(&invalid.to_string()),
                Err(ReadError::Contract {
                    message: ContractViolation::PrivateField,
                    ..
                })
            ),
            "{map}"
        );
    }
    let detail = reader_fixtures::detail("product/browse/home");
    assert_eq!(
        serde_json::to_value(readers::detail_lenient(&detail.to_string()).unwrap()).unwrap(),
        detail
    );
}

#[test]
fn privacy_rejects_unsafe_unknown_paths_and_preserves_other_extension_values() {
    for path in [
        "",
        "   ",
        "/etc/file",
        "../file",
        "a/../file",
        "a/./file",
        "a//file",
        "a/",
        "a\\file",
        "C:file",
        "a\0file",
    ] {
        for key in ["path", "sourcePath", "laterPath"] {
            let mut value = reader_fixtures::index();
            value["later"] = json!([{key:path}]);
            assert!(
                matches!(
                    readers::index_lenient(&value.to_string()),
                    Err(ReadError::Contract {
                        message: ContractViolation::PublicPath,
                        ..
                    })
                ),
                "{key}: {path:?}"
            );
        }
    }
    let mut value = reader_fixtures::index();
    value["later"] = json!({"path":"specs/space name.html","laterPath":42,"url":"/external"});
    assert_eq!(
        readers::index_lenient(&value.to_string())
            .unwrap()
            .schema_version,
        9
    );
    let mut value = reader_fixtures::detail("guide");
    value["later"] = json!({"sourcePath":"../escape"});
    assert!(matches!(
        readers::detail_lenient(&value.to_string()),
        Err(ReadError::Contract {
            message: ContractViolation::PublicPath,
            ..
        })
    ));
    value["later"] = Value::Null;
    assert_eq!(
        readers::detail_lenient(&value.to_string())
            .unwrap()
            .schema_version,
        4
    );
}
