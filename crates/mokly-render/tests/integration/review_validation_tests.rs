//! Returned props, temporary controls, and independent document keys remain validated.

use std::fs;

use mokly_model::data::Props;
use mokly_sidecar::methods::Call;

use super::support::Consumer;

#[test]
fn returned_instance_props_must_satisfy_the_component_schema() {
    for value in ["42", "'this label has more than thirty characters'"] {
        let consumer = Consumer::new();
        consumer.replace(
            "specs/screen.mockup.tsx",
            "label={props.label}",
            &format!("label={{{value}}}"),
        );
        let generation = consumer.generation(consumer.prepare().unwrap());
        let error = generation.render("screen/index.mobile.html").unwrap_err();
        assert!(error.to_string().contains("component-props"), "{error}");
        assert!(
            consumer
                .pool
                .calls
                .lock()
                .unwrap()
                .iter()
                .any(|call| { matches!(call, Call::RenderScreen(_)) })
        );
    }
}

#[test]
fn temporary_props_obey_control_bounds_before_a_sidecar_render() {
    let consumer = Consumer::new();
    consumer.replace(
        "library/chip.tsx",
        "controls: { label: { kind: \"text\", maxLength: 30 } }",
        "controls: { label: { kind: \"text\", maxLength: 5 } }",
    );
    let generation = consumer.generation(consumer.prepare().unwrap());
    let route = "components/chip/index.mobile.html";
    let saved = generation.render(route).unwrap();
    let count = consumer.pool.calls.lock().unwrap().len();
    let invalid: Props = serde_json::from_str(r#"{"label":"Too long"}"#).unwrap();
    assert!(generation.render_props(route, &invalid).is_err());
    assert_eq!(consumer.pool.calls.lock().unwrap().len(), count);
    let valid: Props = serde_json::from_str(r#"{"label":"Short"}"#).unwrap();
    assert!(generation.render_props(route, &valid).is_ok());
    assert_eq!(generation.render(route).unwrap().bytes, saved.bytes);
}

#[test]
fn javascript_changes_leave_markdown_document_keys_stable() {
    let consumer = Consumer::new();
    fs::write(
        consumer.root().join("specs/guide.md"),
        "# Guide\n\nStable text.\n",
    )
    .unwrap();
    let first = consumer.generation(consumer.prepare().unwrap());
    consumer.replace(
        "specs/screen.mockup.tsx",
        "label: \"Hello\"",
        "label: \"After\"",
    );
    let changed = consumer.generation(consumer.prepare().unwrap());
    for route in ["guide/index.html", "guide/index.dark.html"] {
        assert_eq!(first.plans()[route].key, changed.plans()[route].key);
    }
    assert_ne!(
        first.plans()["screen/index.mobile.html"].key,
        changed.plans()["screen/index.mobile.html"].key
    );
    assert_ne!(
        first.plans()["mixed/index.mobile.html"].key,
        changed.plans()["mixed/index.mobile.html"].key
    );
}
