//! Prepared controls carry numeric constraints to every public reader.

use mokly_model::axes::{ColorScheme, EntryKind};
use mokly_model::catalogue::{CatalogueModel, EntryContent, SourceLocation};
use mokly_model::projection::{self, Publication};
use mokly_model::public_metadata::ChangesStatus;
use serde_json::{Value, json};

use crate::config_types::{ResolvedRoot, RootConfig};
use crate::diagnostic::{Code, Issue};
use crate::discovery::{SourceFile, SourceKind};
use crate::input::ParsedEntry;
use crate::prepare_entry::{self, PreparedEntries};
use crate::yaml::Document;
use crate::yaml_positions::Positions;

/// The parsed form of one authored entry module.
fn parsed(value: Value) -> ParsedEntry {
    ParsedEntry {
        input: serde_json::from_value(value.clone()).unwrap(),
        issues: vec![],
        document: Document {
            value,
            positions: Positions::default(),
        },
        body: String::new(),
        body_offset: 0,
        text: String::new(),
    }
}

/// Prepare one authored entry module as the catalogue does.
fn prepare(parsed: &ParsedEntry, kind: EntryKind) -> Result<PreparedEntries, Issue> {
    let file = SourceFile {
        path: "specs/numbers.mockup.tsx".into(),
        absolute: "/repo/specs/numbers.mockup.tsx".into(),
        identity: "specs/numbers.mockup.tsx".into(),
        root_index: 0,
        kind: SourceKind::Module,
        excluded: false,
    };
    let root = ResolvedRoot {
        input: RootConfig {
            dir: "specs".into(),
            files: None,
            path: None,
            transparent: None,
        },
        directory: "/repo/specs".into(),
        identity: "/repo/specs".into(),
    };
    let source = SourceLocation {
        path: file.path.clone(),
        line: 1,
        column: 1,
        export: Some("default".into()),
    };
    prepare_entry::prepare(parsed, &file, &root, kind, source, &[ColorScheme::Light])
}

/// The prepared `count` control of a component, or the codes of its issues.
fn count_control(schema: Value, control: Value, props: Value) -> Result<Value, Vec<Code>> {
    let parsed = parsed(json!({
        "title":"Count", "description":"", "path":"count",
        "propSchema":{"type":"object","additionalProperties":false,"properties":{"count":schema}},
        "props":props, "controls":{"count":control}
    }));
    let prepared = prepare(&parsed, EntryKind::Component).map_err(|issue| vec![issue.code])?;
    if !prepared.issues.is_empty() {
        return Err(prepared.issues.iter().map(|issue| issue.code).collect());
    }
    match &prepared.entries[0].content {
        EntryContent::Component { visual, .. } => {
            Ok(serde_json::to_value(&visual.controls).unwrap()["count"].clone())
        }
        _ => panic!("component entry"),
    }
}

#[test]
fn declared_numeric_controls_publish_effective_bounds_for_parents_and_variants() {
    let parsed = parsed(json!({
        "title":"Numbers", "description":"Number controls", "path":"numbers",
        "propSchema":{"type":"object","additionalProperties":false,"properties":{
            "integer":{"type":"integer","minimum":2,"maximum":10},
            "multiple":{"type":"integer","multipleOf":2},
            "decimal":{"type":"number","minimum":0.5,"maximum":10,"multipleOf":0.25},
            "explicit":{"type":"number","minimum":0,"maximum":20,"multipleOf":1},
            "partial":{"type":"number","minimum":0,"maximum":10,"multipleOf":0.5},
            "free":{"type":"number"}, "text":{"type":"string"}
        }},
        "props":{"integer":4,"multiple":4,"decimal":1,"explicit":6,"partial":2,"free":1,"text":"Hi"},
        "controls":{
            "integer":{"kind":"number","label":"Count","description":"Whole items"},
            "multiple":{"kind":"number"}, "decimal":{"kind":"number"},
            "explicit":{"kind":"number","minimum":3,"maximum":12,"step":3},
            "partial":{"kind":"number","minimum":2}, "free":{"kind":"number"},
            "text":{"kind":"text"}
        },
        "variants":[{"slug":"other","title":"Other","props":{"integer":6}}]
    }));
    for kind in [EntryKind::Screen, EntryKind::Component] {
        let prepared = prepare(&parsed, kind).unwrap();
        assert!(prepared.issues.is_empty(), "{:?}", prepared.issues);
        assert_eq!(prepared.entries.len(), 2);
        let expected = json!({
            "integer":{"kind":"number","label":"Count","description":"Whole items","minimum":2,"maximum":10,"step":1},
            "multiple":{"kind":"number","step":2},
            "decimal":{"kind":"number","minimum":0.5,"maximum":10,"step":0.25},
            "explicit":{"kind":"number","minimum":3,"maximum":12,"step":3},
            "partial":{"kind":"number","minimum":2,"maximum":10,"step":0.5},
            "free":{"kind":"number"}, "text":{"kind":"text"}
        });
        for entry in &prepared.entries {
            let visual = match &entry.content {
                EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                    visual
                }
                _ => panic!("visual entry"),
            };
            assert_eq!(serde_json::to_value(&visual.controls).unwrap(), expected);
            assert_eq!(
                serde_json::to_value(&visual.prop_schema).unwrap(),
                parsed.input.prop_schema.clone().unwrap()
            );
        }
        let model = CatalogueModel {
            entries: prepared.entries,
            folders: vec![],
            sources: vec![],
            color_schemes: vec![ColorScheme::Light],
        };
        let state = Publication {
            config_path: "mokly.config.json".into(),
            deployment_id: "test".into(),
            revision: 1,
            base: None,
            changes_status: ChangesStatus::Disabled,
            live_generation: None,
        };
        let index = projection::index(&model, &[], &state);
        let json = serde_json::to_value(index).unwrap();
        let entries = if kind == EntryKind::Screen {
            &json["screens"]
        } else {
            &json["components"]
        };
        for entry in entries.as_array().unwrap() {
            assert_eq!(entry["controls"], expected);
        }
    }
    assert_eq!(
        serde_json::to_value(parsed.input.controls.clone().unwrap()).unwrap()["integer"],
        json!({"kind":"number","label":"Count","description":"Whole items"})
    );
}

#[test]
fn declared_number_steps_must_fit_integer_types_and_schema_multiples() {
    for (step, multiple, accepted) in [
        (json!(3), 2, false),
        (json!(0.5), 1, false),
        (json!(6), 2, true),
    ] {
        let expected = if accepted {
            Ok(json!({"kind":"number","minimum":0,"maximum":4,"step":step}))
        } else {
            Err(vec![Code::ComponentControls])
        };
        assert_eq!(
            count_control(
                json!({"type":"integer","multipleOf":multiple}),
                json!({"kind":"number","minimum":0,"maximum":4,"step":step}),
                json!({"count":0}),
            ),
            expected,
            "step {step}, multiple {multiple}"
        );
    }
}

#[test]
fn an_omitted_integer_control_step_keeps_its_schema_multiple() {
    assert_eq!(
        count_control(
            json!({"type":"integer","multipleOf":0.5}),
            json!({"kind":"number"}),
            json!({"count":0}),
        ),
        Ok(json!({"kind":"number","step":0.5}))
    );
}

/// An unsafe integer is stored as its binary64 value, as its schema and
/// props are after data decoding: 1000000000000000100 reads 1000000000000000128.
#[test]
fn unsafe_text_and_select_controls_keep_their_schema_values() {
    let count = json!(1000000000000000100u64);
    let stored = json!(1000000000000000128.0);
    assert_eq!(
        count_control(
            json!({"type":"string","minLength":count,"maxLength":count}),
            json!({"kind":"text","maxLength":count}),
            json!({}),
        ),
        Ok(json!({"kind":"text","maxLength":stored}))
    );
    assert_eq!(
        count_control(
            json!({"enum":[count]}),
            json!({"kind":"select","options":[{"label":"Large","value":count}]}),
            json!({}),
        ),
        Ok(json!({"kind":"select","options":[{"label":"Large","value":stored}]}))
    );
}
