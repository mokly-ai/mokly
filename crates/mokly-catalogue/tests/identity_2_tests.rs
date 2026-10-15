//! Isolated catalogue behavior fixtures.

#[path = "support/fixtures.rs"]
mod fixtures;

#[test]
fn missing_front_matter() {
    fixtures::check("missing-front-matter");
}

#[test]
fn yaml_duplicate() {
    fixtures::check("yaml-duplicate");
}

#[test]
fn yaml_custom_tag() {
    fixtures::check("yaml-custom-tag");
}

#[test]
fn yaml_alias_core() {
    fixtures::check("yaml-alias-core");
}

#[test]
fn unknown_field() {
    fixtures::check("unknown-field");
}

#[test]
fn forbidden_element() {
    fixtures::check("forbidden-element");
}

#[test]
fn unknown_element() {
    fixtures::check("unknown-element");
}

#[test]
fn reserved_element() {
    fixtures::check("reserved-element");
}

#[test]
fn unknown_prop() {
    fixtures::check("unknown-prop");
}

#[test]
fn object_prop() {
    fixtures::check("object-prop");
}

#[test]
fn if_prop_type() {
    fixtures::check("if-prop-type");
}

#[test]
fn unused_prop() {
    fixtures::check("unused-prop");
}

#[test]
fn page() {
    fixtures::check("page");
}

#[test]
fn incomplete_page() {
    fixtures::check("incomplete-page");
}

#[test]
fn page_prop() {
    fixtures::check("page-prop");
}

#[test]
fn document_bom_crlf() {
    fixtures::check("document-bom-crlf");
}

#[test]
fn document_repeated() {
    fixtures::check("document-repeated");
}

#[test]
fn document_malformed() {
    fixtures::check("document-malformed");
}

#[test]
fn document_unclosed() {
    fixtures::check("document-unclosed");
}

#[test]
fn document_unknown() {
    fixtures::check("document-unknown");
}

#[test]
fn document_wrong_type() {
    fixtures::check("document-wrong-type");
}

#[test]
fn document_bare_strings() {
    fixtures::check("document-bare-strings");
}

#[test]
fn variant_null_field() {
    fixtures::check("variant-null-field");
}

#[test]
fn invalid_control_segment() {
    fixtures::check("invalid-control-segment");
}
