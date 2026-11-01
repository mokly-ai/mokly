//! Version gates must run before any current-format payload decoding.

use crate::readers::{ReadError, deployment, detail, index, live};
use crate::versions;

#[test]
fn all_versioned_boundaries_reject_versions_before_payloads() {
    enum Reader {
        Index,
        Deployment,
        Detail,
        Live,
    }
    let readers = [
        ("catalogue index", versions::CATALOGUE_INDEX, Reader::Index),
        (
            "deployment file",
            versions::DEPLOYMENT_FILE,
            Reader::Deployment,
        ),
        ("entry detail", versions::ENTRY_DETAIL, Reader::Detail),
        ("live descriptor", versions::LIVE_DESCRIPTOR, Reader::Live),
    ];
    for (boundary, expected, reader) in readers {
        for version in (0..expected).chain([expected + 1, 999]) {
            let text = format!(
                r#"{{"schemaVersion":{version},"identity":false,"entry":42,"render":null}}"#
            );
            let error = match reader {
                Reader::Index => index(&text).map(|_| ()),
                Reader::Deployment => deployment(&text).map(|_| ()),
                Reader::Detail => detail(&text).map(|_| ()),
                Reader::Live => live(&text).map(|_| ()),
            };
            assert!(matches!(
                error,
                Err(ReadError::Version { boundary: actual, expected: found, .. })
                    if actual == boundary && found == expected
            ));
        }
        for text in [
            "{}".to_owned(),
            format!(r#"{{"schemaVersion":"{expected}"}}"#),
            format!(r#"{{"schemaVersion":{expected}.0}}"#),
        ] {
            let error = match reader {
                Reader::Index => index(&text).map(|_| ()),
                Reader::Deployment => deployment(&text).map(|_| ()),
                Reader::Detail => detail(&text).map(|_| ()),
                Reader::Live => live(&text).map(|_| ()),
            };
            assert!(matches!(error, Err(ReadError::Version { .. })));
        }
    }
}

#[test]
fn deployment_file_gates_and_validates_its_identity() {
    let id = "a".repeat(64);
    let text = format!(r#"{{"schemaVersion":1,"deploymentId":"{id}"}}"#);
    assert_eq!(deployment(&text).unwrap().deployment_id, id);
    assert!(matches!(
        deployment(r#"{"schemaVersion":2,"deploymentId":42}"#),
        Err(ReadError::Version { .. })
    ));
    assert!(matches!(
        deployment(r#"{"schemaVersion":1,"deploymentId":"bad"}"#),
        Err(ReadError::Contract { .. })
    ));
}

#[test]
fn version_errors_print_the_number_without_rust_debug_wrapping() {
    let error = index(r#"{"schemaVersion":6}"#).unwrap_err().to_string();
    assert_eq!(
        error,
        "[mokly-model/version] catalogue index requires schemaVersion 9; received 6"
    );
    let missing = index("{}").unwrap_err().to_string();
    assert!(missing.ends_with("received missing or not an integer"));
}

#[test]
fn live_descriptor_accepts_only_the_typed_current_capability() {
    let text = r#"{"schemaVersion":3,"generation":"abc","render":{"url":"/mokly-viewer/components/render","token":"private"}}"#;
    assert_eq!(live(text).unwrap().generation, "abc");
    assert!(live(&text.replace("/mokly-viewer/components/render", "https://example.com")).is_err());
    assert!(live(&text.replace("\"private\"", "\"\"")).is_err());
    assert!(live(&text.replace("\"generation\"", "\"revision\"")).is_err());
}
