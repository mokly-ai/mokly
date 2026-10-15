//! Invalid authoring inputs fail before any sidecar render starts.

use std::fs;

use mokly_catalogue::diagnostic::{Code, WarningSubject};
use mokly_catalogue::error::CatalogueError;
use mokly_sidecar::methods::Call;

use super::support::Consumer;

#[test]
fn rust_validates_raw_component_schemas_before_rendering() {
    let consumer = Consumer::new();
    consumer.replace(
        "library/chip.tsx",
        "maxLength: 30",
        "maxLength: 30, default: 'invalid'",
    );
    let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
        panic!("authoring failure")
    };
    assert!(
        issues
            .iter()
            .any(|issue| issue.code == Code::ComponentSchema)
    );
    assert!(
        !consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .any(|call| matches!(call, Call::RenderComponent(_) | Call::RenderScreen(_)))
    );
}

#[test]
fn inference_warnings_name_the_final_entry_path_and_key() {
    let consumer = Consumer::new();
    consumer.replace(
        "specs/screen.mockup.tsx",
        "title: \"React screen\",",
        "title: \"React screen\", path: \"renamed\",",
    );
    consumer.replace(
        "specs/screen.mockup.tsx",
        "props: { label: \"Hello\" }",
        "props: { label: \"Hello\", callback: () => {} }",
    );
    let prepared = consumer.prepare().unwrap();
    assert!(
        prepared
            .warnings
            .iter()
            .any(|warning| warning.code == "props-not-data"
                && warning.subject == WarningSubject::Entry("renamed".into())
                && warning.message.contains("callback"))
    );
}

#[test]
fn invalid_variant_fields_use_the_final_path_and_skip_dependent_prop_checks() {
    let consumer = Consumer::new();
    consumer.replace(
        "library/chip.tsx",
        "title: \"Chip\",",
        "title: \"Chip\", path: 'components/final',",
    );
    consumer.replace(
        "library/chip.tsx",
        "slug: \"emphasis\",",
        "slug: \"emphasis\", path: 'forbidden',",
    );
    consumer.replace("library/chip.tsx", "label: \"Bold\"", "label: false");
    let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
        panic!("metadata failure")
    };
    assert_eq!(issues.len(), 1, "{issues:?}");
    assert_eq!(issues[0].code, Code::InvalidField);
    assert_eq!(issues[0].message, "unknown field path");
    assert_eq!(
        issues[0].entry_path.as_deref(),
        Some("components/final/emphasis")
    );
}

#[test]
fn arrays_of_definitions_and_element_collisions_keep_their_codes() {
    let consumer = Consumer::new();
    let path = consumer.root().join("specs/components/chip.mockup.tsx");
    let source = fs::read_to_string(&path).unwrap();
    for array in ["[chip]", "[[[chip]]]"] {
        fs::write(&path, format!("{source}\nimport {{ chip }} from \"../../library/chip.js\";\nexport const invalid = {array};\n")).unwrap();
        let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
            panic!("array failure")
        };
        assert!(issues.iter().any(|issue| issue.code == Code::ArrayExport));
    }
    fs::write(&path, source).unwrap();
    fs::write(consumer.root().join("specs/collision.component.html"), "---\ntitle: Collision\nelement: app-chip\npropSchema: {type: object, additionalProperties: false, properties: {}}\n---\n<p>Other</p>").unwrap();
    let CatalogueError::Invalid { issues, .. } = consumer.prepare().unwrap_err() else {
        panic!("element failure")
    };
    assert!(
        issues
            .iter()
            .any(|issue| issue.code == Code::ComponentElement)
    );
}
