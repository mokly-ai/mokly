//! Unsafe schema numbers round before validation, and control steps keep their schema multiple.

use std::fs;

use mokly_test_support::consumer;
use mokly_test_support::readers;

use super::support::{build, index, index_bytes, wire_number};

fn schema_case(schema: &str, negative: bool) {
    let authored = if negative {
        "-9007199254740993"
    } else {
        "9007199254740993"
    };
    let rounded: i64 = if negative {
        -9_007_199_254_740_992
    } else {
        9_007_199_254_740_992
    };
    let component = format!(
        "---
title: Number
element: ui-number
propSchema: {{type: object, additionalProperties: false, properties: {{count: {schema}}}}}
props: {{count: {authored}}}
---
<p>{{{{count}}}}</p>"
    );
    let home = format!("---\ntitle: Home\n---\n<ui-number count='{rounded}'></ui-number>");
    let root = consumer::project(&[
        ("specs/number.component.html", &component),
        ("specs/home.screen.html", &home),
    ]);
    let path = root.path();
    let result = build(path, false);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(
        result
            .stderr
            .contains("schema keyword \"/properties/count/"),
        "{}",
        result.stderr
    );
    let previous = index_bytes(path);
    let catalogue = readers::index(&previous);
    assert_eq!(
        wire_number(&catalogue["components"][0]["props"], "count"),
        rounded as f64
    );
    for entry in ["home", "number"] {
        let html = fs::read_to_string(path.join(format!(
            "mokly-static/static/mokly-generated/{entry}/index.mobile.html"
        )))
        .unwrap();
        assert!(html.contains(&format!("<p>{rounded}</p>")), "{html}");
    }
    let strict = build(path, true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert!(strict.stderr.contains("build warnings with --strict"));
    assert_eq!(index_bytes(path), previous);
}

#[test]
fn unsafe_schema_keywords_and_matching_saved_props_round_before_validation_and_coercion() {
    for (schema, negative) in [
        ("{type: integer, minimum: 9007199254740993}", false),
        ("{type: integer, maximum: -9007199254740993}", true),
        ("{type: integer, multipleOf: 9007199254740993}", false),
        ("{enum: [9007199254740993]}", false),
        ("{const: 9007199254740993}", false),
        ("{oneOf: [{const: 9007199254740993, title: Large}]}", false),
    ] {
        schema_case(schema, negative);
    }
}

#[test]
fn javascript_schema_numbers_retain_binary64_identity_across_json_transport() {
    let root = consumer::project(&[(
        "specs/number.mockup.ts",
        "import React from 'react';
import {defineScreen} from '@mokly/mokly';
const count=1000000000000000100;
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{const:count}}},
  props:{count},render:({count})=>React.createElement('p',null,count)});",
    )]);
    let result = build(root.path(), false);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(
        result
            .stderr
            .contains("schema keyword \"/properties/count/const\"")
    );
    let catalogue = index(root.path());
    assert_eq!(
        wire_number(&catalogue["screens"][0]["props"], "count"),
        1_000_000_000_000_000_100_f64
    );
}

#[test]
fn an_omitted_integer_control_step_keeps_its_schema_multiple() {
    let root = consumer::project(&[(
        "specs/number.mockup.ts",
        "import React from 'react';
import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer',multipleOf:0.5}}},
  props:{count:0},controls:{count:{kind:'number'}},render:({count})=>React.createElement('p',null,count)});",
    )]);
    let result = build(root.path(), false);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
}
