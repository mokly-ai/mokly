//! Template prop failures name the authored characters behind decoded tokens.

use std::collections::{BTreeMap, BTreeSet};

use mokly_model::prop_schema::PropSchema;

use crate::diagnostic::Code;
use crate::template_role::TemplateRole;
use crate::template_types::Template;
use crate::templates::validate;

fn check(body: &str, line: usize, column: usize) {
    let header = "---\ntitle: Home\n---\n";
    let template = Template {
        source_path: "specs/home.screen.html".into(),
        source: format!("{header}{body}"),
        body: body.into(),
        body_offset: header.len(),
        page: false,
    };
    let result = validate(
        &template,
        &PropSchema::default(),
        TemplateRole::EntryBody {
            path: "home",
            slots: None,
        },
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    let issue = result
        .issues
        .iter()
        .find(|issue| issue.code == Code::HtmlProps)
        .unwrap();
    let location = issue.location.as_ref().unwrap();
    assert_eq!(location.path, template.source_path);
    assert_eq!((location.line, location.column), (line, column), "{body:?}");
}

#[test]
fn attribute_value_substitution_names_its_opening_braces() {
    check("<p title=\"{{missing}}\">t</p>", 4, 11);
}

#[test]
fn attribute_value_after_references_names_its_opening_braces() {
    check("<p data-x=\"&amp;&amp; {{missing}}\">t</p>", 4, 23);
}

#[test]
fn text_after_references_names_its_opening_braces() {
    check("<p>&amp;&amp;&amp; {{missing}}</p>", 4, 20);
}

#[test]
fn text_after_crlf_names_its_opening_braces() {
    check("<p>\r\n\r\n  {{missing}}</p>", 6, 3);
}

#[test]
fn attribute_value_after_crlf_names_its_opening_braces() {
    check("<p title=\"\r\n\r\n  {{missing}}\">t</p>", 6, 3);
}

#[test]
fn text_after_cr_names_its_opening_braces() {
    check("<p>\r\r  {{missing}}</p>", 6, 3);
}

#[test]
fn attribute_value_after_cr_names_its_opening_braces() {
    check("<p title=\"\r\r  {{missing}}\">t</p>", 6, 3);
}

#[test]
fn reference_produced_braces_name_the_first_reference() {
    check("<p>&amp; &lbrace;&lbrace;missing}}</p>", 4, 10);
}

#[test]
fn plain_and_lf_text_keep_their_locations() {
    check("<p>ab {{missing}}</p>", 4, 7);
    check("<p>\n  {{missing}}</p>", 5, 3);
}

#[test]
fn utf8_and_bom_keep_character_columns() {
    check("<p>é中 {{missing}}</p>", 4, 7);
    check("\u{feff}<p>{{missing}}</p>", 4, 5);
}

#[test]
fn value_quotes_and_replaced_nul_keep_source_offsets() {
    for (body, column) in [
        ("<p title={{missing}}>t</p>", 10),
        ("<p title='{{missing}}'>t</p>", 11),
        ("<p title=\"{{missing}}\">t</p>", 11),
        ("<p title=\"\0{{missing}}\">t</p>", 12),
    ] {
        check(body, 4, column);
    }
}
