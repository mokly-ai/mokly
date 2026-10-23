//! Component registry and exact folder-record diagnostics.

#[path = "support/fixtures.rs"]
mod fixtures;

#[test]
fn component_cycle() {
    fixtures::check("component-cycle");
}

#[test]
fn component_element_duplicate() {
    fixtures::check("component-element-duplicate");
}

#[test]
fn component_element_reserved() {
    fixtures::check("component-element-reserved");
}

#[test]
fn component_foster_parented() {
    fixtures::check("component-foster-parented");
}

#[test]
fn component_missing_schema() {
    fixtures::check("component-missing-schema");
}

#[test]
fn component_prop_reference() {
    fixtures::check("component-prop-reference");
}

#[test]
fn component_props_invalid() {
    fixtures::check("component-props-invalid");
}

#[test]
fn component_registry() {
    fixtures::check("component-registry");
}

#[test]
fn component_reserved_prop() {
    fixtures::check("component-reserved-prop");
}

#[test]
fn component_schema_open() {
    fixtures::check("component-schema-open");
}

#[test]
fn component_slot_data_conflict() {
    fixtures::check("component-slot-data-conflict");
}

#[test]
fn component_slot_placeholder() {
    fixtures::check("component-slot-placeholder");
}

#[test]
fn component_slot_supply() {
    fixtures::check("component-slot-supply");
}

#[test]
fn component_unknown_reference() {
    fixtures::check("component-unknown-reference");
}

#[test]
fn component_variant() {
    fixtures::check("component-variant");
}

#[test]
fn component_variant_invalid() {
    fixtures::check("component-variant-invalid");
}

#[test]
fn component_variant_schemes_and_related_docs_are_unknown_fields() {
    fixtures::check("component-variant-inherited-fields");
}

#[test]
fn folder_invalid_exclude() {
    fixtures::check("folder-invalid-exclude");
}

#[test]
fn folder_invalid_hidden() {
    fixtures::check("folder-invalid-hidden");
}

#[test]
fn folder_invalid_object() {
    fixtures::check("folder-invalid-object");
}

#[test]
fn folder_invalid_order() {
    fixtures::check("folder-invalid-order");
}

#[test]
fn folder_invalid_order_index() {
    fixtures::check("folder-invalid-order-index");
}

#[test]
fn folder_invalid_title() {
    fixtures::check("folder-invalid-title");
}

#[test]
fn folder_invalid_unknown() {
    fixtures::check("folder-invalid-unknown");
}
