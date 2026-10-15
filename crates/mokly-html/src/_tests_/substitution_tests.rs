//! Template spacing follows the catalogue grammar in text and attribute paths.

use std::collections::BTreeMap;

use mokly_model::catalogue::SourceLocation;
use mokly_model::usage::ComponentInputOwner;
use serde_json::json;

use crate::conditions::attribute_value;
use crate::context::Context;
use crate::props::{substitute, substitute_raw};

fn context() -> Context {
    Context {
        raw_text: false,
        link_base: String::new(),
        replay: false,
        props: serde_json::from_value(json!({
            "label": "<A & B>", "enabled": true, "disabled": false,
            "badge": {"count": 2}
        }))
        .unwrap(),
        schema: serde_json::from_value(json!({
            "type": "object", "additionalProperties": false,
            "properties": {
                "label": {"type": "string"}, "enabled": {"type": "boolean"},
                "disabled": {"type": "boolean"}, "optional": {"type": "string"},
                "badge": {"type": "object", "additionalProperties": false,
                    "properties": {"count": {"type": "integer"}}}
            }
        }))
        .unwrap(),
        source: SourceLocation {
            path: "specs/home.screen.html".into(),
            line: 1,
            column: 1,
            export: None,
        },
        owner: ComponentInputOwner::Entry,
        slot_key: None,
        ignore: true,
        slots: BTreeMap::new(),
        declared_slots: Vec::new(),
    }
}

#[test]
fn substitutions_accept_ascii_spacing_in_text_dotted_paths_and_raw_styles() {
    let context = context();
    for spacing in ["", " ", "\t", "\n", "\r", "\u{000c}", " \t\n\r\u{000c}"] {
        let text = format!(
            "{{{{{spacing}label{spacing}}}}}/{{{{{spacing}badge.count{spacing}}}}}/{{{{{spacing}optional{spacing}}}}}"
        );
        assert_eq!(
            substitute(&text, &context.schema, &context.props).unwrap(),
            "<A & B>/2/",
            "{spacing:?}"
        );
        assert_eq!(
            substitute_raw(&text, &context.schema, &context.props).unwrap(),
            "&lt;A &amp; B&gt;/2/",
            "{spacing:?}"
        );
    }
}

#[test]
fn exact_attribute_substitutions_preserve_boolean_and_optional_rules() {
    let context = context();
    for spacing in ["", " ", "\t\r\n\u{000c}"] {
        for (name, expected) in [
            ("enabled", Some(String::new())),
            ("disabled", None),
            ("optional", None),
            ("badge.count", Some("2".into())),
        ] {
            let text = format!("{{{{{spacing}{name}{spacing}}}}}");
            assert_eq!(attribute_value(&text, &context).unwrap(), expected);
        }
    }
    assert_eq!(
        attribute_value("prefix {{ label }} suffix", &context).unwrap(),
        Some("prefix <A & B> suffix".into())
    );
    assert_eq!(
        attribute_value(" {{ enabled }} ", &context).unwrap(),
        Some(" true ".into())
    );
}

#[test]
fn spacing_keeps_reference_validation_and_unclosed_text() {
    let context = context();
    for text in [
        "{{ missing }}",
        "{{ badge }}",
        "{{ badge .count }}",
        "{{\u{a0}label\u{a0}}}",
    ] {
        assert!(substitute(text, &context.schema, &context.props).is_err());
        assert!(attribute_value(text, &context).is_err());
    }
    assert_eq!(
        substitute("literal {{ label", &context.schema, &context.props).unwrap(),
        "literal {{ label"
    );
}
