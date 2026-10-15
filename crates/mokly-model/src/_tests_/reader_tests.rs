//! Version gates must run before any current-format payload decoding.

use crate::readers::{ReadError, detail, index, live};

#[test]
fn all_three_boundaries_reject_versions_before_payloads() {
    for version in [0, 1, 2, 6, 7, 8, 999] {
        let text =
            format!(r#"{{"schemaVersion":{version},"identity":false,"entry":42,"render":null}}"#);
        if version != 7 {
            assert!(matches!(index(&text), Err(ReadError::Version { .. })));
        }
        if version != 1 {
            assert!(matches!(detail(&text), Err(ReadError::Version { .. })));
        }
        if version != 3 {
            assert!(matches!(live(&text), Err(ReadError::Version { .. })));
        }
    }
    for text in ["{}", r#"{"schemaVersion":"7"}"#, r#"{"schemaVersion":7.0}"#] {
        assert!(matches!(index(text), Err(ReadError::Version { .. })));
    }
}

#[test]
fn version_errors_print_the_number_without_rust_debug_wrapping() {
    let error = index(r#"{"schemaVersion":6}"#).unwrap_err().to_string();
    assert_eq!(
        error,
        "[mokly-model/version] catalogue index requires schemaVersion 7; received 6"
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
