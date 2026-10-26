//! Unsafe schema numbers round before validation, and live edits keep binary64 values.

use std::fs;
use std::path::Path;

use mokly_test_support::consumer;
use mokly_test_support::http;
use mokly_test_support::readers;
use mokly_test_support::serve::{self, Serve};
use serde_json::{Value, json};

use super::support::{build, index, index_bytes, mokly, wire_number};

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

/// Serve `root`, render the entries that `pick` selects live with `overrides`,
/// and expect every render to succeed.
fn live_renders(root: &Path, pick: &dyn Fn(&Value) -> Vec<String>, overrides: &Value, page: &str) {
    let mut running = Serve::start(&mokly(), root, &[]);
    let url = running.ready();
    let (raw, _) = serve::completed(&url, "number");
    let catalogue = readers::index(raw.to_string().as_bytes());
    let live = readers::live(&http::get(&url, "/mokly-viewer/live.json").text());
    for entry_path in pick(&catalogue) {
        let body = json!({
            "entryPath": entry_path,
            "viewport": "mobile",
            "colorScheme": "light",
            "revision": catalogue["revision"],
            "pageId": page.repeat(32),
            "overrides": overrides,
        });
        let response = http::post(
            &url,
            live["render"]["url"].as_str().unwrap(),
            &[
                ("content-type", "application/json"),
                ("origin", &url),
                (
                    "x-mokly-render-token",
                    live["render"]["token"].as_str().unwrap(),
                ),
            ],
            body.to_string().as_bytes(),
        );
        assert_eq!(response.status, 200, "{}", response.text());
    }
    running.close();
}

#[cfg(unix)]
#[test]
fn unsafe_number_text_and_select_controls_keep_their_schema_values_during_builds_and_live_edits() {
    for (name, schema, control) in [
        (
            "number",
            "{type:'integer',minimum:count,maximum:count}",
            "{kind:'number',maximum:count}",
        ),
        (
            "text",
            "{type:'string',minLength:count,maxLength:count}",
            "{kind:'text',maxLength:count}",
        ),
        (
            "select",
            "{enum:[count]}",
            "{kind:'select',options:[{label:'Large',value:count}]}",
        ),
    ] {
        let source = format!(
            "import React from 'react';
import {{defineScreen}} from '@mokly/mokly';
const count=1000000000000000100;
export default defineScreen({{title:'Number',description:'',relatedDocs:[],
  propSchema:{{type:'object',additionalProperties:false,properties:{{count:{schema}}}}},
  props:{{}},variants:[{{slug:'saved',title:'Saved',props:{{}}}}],controls:{{count:{control}}},render:()=>React.createElement('p',null,'Number')}});"
        );
        let root = consumer::project(&[("specs/number.mockup.ts", &source)]);
        let result = build(root.path(), false);
        assert_eq!(result.code, Some(0), "{name}: {}", result.stderr);
        let overrides = if name == "text" {
            json!({})
        } else {
            json!({ "count": { "kind": "set", "value": 1_000_000_000_000_000_100_u64 } })
        };
        live_renders(
            root.path(),
            &|_| vec!["number".to_owned(), "number/saved".to_owned()],
            &overrides,
            "a",
        );
    }
}

#[cfg(unix)]
#[test]
fn unsafe_story_control_hints_retain_binary64_limits_for_live_edits() {
    let root = consumer::project(&[(
        "specs/number.stories.tsx",
        "import React from 'react';
const count=1000000000000000100;
export default {title:'Number',component:({count})=>React.createElement('p',null,count),
  args:{count},argTypes:{count:{control:{type:'number',min:count,max:count}}}};
export const Saved={};",
    )]);
    let overrides = json!({ "count": { "kind": "set", "value": 1_000_000_000_000_000_100_u64 } });
    let first = |index: &Value| vec![index["components"][0]["path"].as_str().unwrap().to_owned()];
    live_renders(root.path(), &first, &overrides, "b");
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
