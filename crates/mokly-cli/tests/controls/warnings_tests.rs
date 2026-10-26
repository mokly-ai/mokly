//! Unsafe integers in controls and props warn once, round to binary64, and fail strict builds.

use std::fs;

use mokly_test_support::consumer;
use regex::Regex;

use super::support::{UNSAFE, build, count, index, index_bytes, wire_number};

fn unsafe_lines(stderr: &str) -> Vec<&str> {
    stderr
        .split('\n')
        .filter(|line| line.contains(UNSAFE))
        .collect()
}

fn control_only_warns_once(controls: &str, pointer: &str, text: bool) {
    let (kind, value) = if text {
        ("string", "''")
    } else {
        ("integer", "0")
    };
    let source = format!(
        "import React from 'react';
import {{defineScreen}} from '@mokly/mokly';
export default defineScreen({{title:'Number',description:'',relatedDocs:[],
  propSchema:{{type:'object',additionalProperties:false,properties:{{count:{{type:'{kind}'}}}}}},
  props:{{count:{value}}},controls:{{count:{controls}}},
  variants:[{{slug:'saved',title:'Saved',props:{{}}}}],
  render:({{count}})=>React.createElement('p',null,count)}});"
    );
    let root = consumer::project(&[("specs/number.mockup.ts", &source)]);
    let path = root.path();
    let ordinary = build(path, false);
    assert_eq!(ordinary.code, Some(0), "{}", ordinary.stderr);
    let lines = unsafe_lines(&ordinary.stderr);
    let previous = index_bytes(path);
    let strict = build(path, true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert_eq!(
        lines,
        [format!(
            "[mokly/warning] entry \"number\": control \"{pointer}\" {UNSAFE}"
        )]
    );
    assert!(strict.stderr.contains("1 build warning with --strict"));
    assert_eq!(index_bytes(path), previous);
}

#[test]
fn unsafe_control_only_values_warn_once_and_strict_preserves_installed_output() {
    for (controls, pointer, text) in [
        (
            "{kind:'number',minimum:-9007199254740993}",
            "/count/minimum",
            false,
        ),
        (
            "{kind:'number',maximum:9007199254740993}",
            "/count/maximum",
            false,
        ),
        (
            "{kind:'number',step:9007199254740993}",
            "/count/step",
            false,
        ),
        (
            "{kind:'text',maxLength:9007199254740993}",
            "/count/maxLength",
            true,
        ),
        (
            "{kind:'select',options:[{label:'Safe',value:0},{label:'Large',value:9007199254740993}]}",
            "/count/options/1/value",
            false,
        ),
    ] {
        control_only_warns_once(controls, pointer, text);
    }
}

#[test]
fn unsafe_story_only_control_hints_warn_on_their_entry_without_changing_schema_warnings() {
    let root = consumer::project(&[(
        "specs/number.stories.tsx",
        "import React from 'react';
export default {title:'Number',component:({count})=>React.createElement('p',null,count),args:{count:0}};
export const Saved={argTypes:{count:{control:{type:'number',max:9007199254740993}}}};",
    )]);
    let ordinary = build(root.path(), false);
    assert_eq!(ordinary.code, Some(0), "{}", ordinary.stderr);
    assert_eq!(
        unsafe_lines(&ordinary.stderr),
        [format!(
            "[mokly/warning] component \"number/Saved\": control \"/count/maximum\" {UNSAFE}"
        )]
    );
    let strict = build(root.path(), true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert!(strict.stderr.contains("1 build warning with --strict"));
}

#[test]
fn story_choice_hints_warn_per_subject_and_ignore_unused_numeric_hints() {
    let root = consumer::project(&[(
        "specs/number.stories.tsx",
        "import React from 'react';
export default {title:'Number',component:({count})=>React.createElement('p',null,count),args:{count:0},
  argTypes:{count:{options:[0,9007199254740993],control:{max:9007199254740993}},
    missing:{control:{max:9007199254740993}}}};
export const Saved={};",
    )]);
    let result = build(root.path(), true);
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    let expected: Vec<String> = ["number", "number/Saved"]
        .iter()
        .map(|entry| {
            format!(
                "[mokly/warning] component \"{entry}\": control \"/count/options/1/value\" {UNSAFE}"
            )
        })
        .collect();
    assert_eq!(unsafe_lines(&result.stderr), expected);
    assert!(result.stderr.contains("2 build warnings with --strict"));
}

#[test]
fn safe_controls_do_not_add_unsafe_integer_warnings() {
    let root = consumer::project(&[(
        "specs/number.mockup.ts",
        "import React from 'react';
import {defineScreen} from '@mokly/mokly';
export default defineScreen({title:'Number',description:'',relatedDocs:[],
  propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer'}}},
  props:{count:0},controls:{count:{kind:'number',minimum:-9007199254740991,maximum:9007199254740991,step:1}},
  render:({count})=>React.createElement('p',null,count)});",
    )]);
    let result = build(root.path(), true);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let unsafe_text =
        Regex::new("props-unsafe-integer|outside the JavaScript safe integer range").unwrap();
    assert!(!unsafe_text.is_match(&result.stderr));
}

#[test]
fn unsafe_nested_react_props_warn_and_strict_keeps_the_installed_output() {
    let root = consumer::project(&[(
        "specs/entries.mockup.ts",
        "import React from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly';
      export const count=defineComponent({path:'count',title:'Count',description:'',relatedDocs:[],
        propSchema:{type:'object',additionalProperties:false,properties:{count:{type:'integer'}},required:['count']},
        props:{count:0},render:({count})=>React.createElement('p',null,count)});
      export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],
        render:()=>React.createElement(count.Component,{count:9007199254740993})});",
    )]);
    let path = root.path();
    let built = build(path, false);
    assert_eq!(built.code, Some(0), "{}", built.stderr);
    assert_eq!(
        count(&built.stderr, "outside the JavaScript safe integer range"),
        1,
        "{}",
        built.stderr
    );
    let previous = index_bytes(path);
    let strict = build(path, true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert!(strict.stderr.contains("1 build warning with --strict"));
    assert_eq!(index_bytes(path), previous);
}

#[test]
fn unsafe_literal_component_props_use_the_rounded_value_before_validation() {
    let root = consumer::project(&[
        (
            "specs/number.component.html",
            "---
title: Number
element: ui-number
propSchema: {type: object, additionalProperties: false, properties: {count: {type: integer, maximum: 9007199254740992}}}
props: {count: 0}
---
<p>{{count}}</p>",
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<ui-number count='9007199254740993'></ui-number>",
        ),
    ]);
    let path = root.path();
    let result = build(path, false);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(
        count(&result.stderr, "outside the JavaScript safe integer range"),
        2,
        "{}",
        result.stderr
    );
    let html =
        fs::read_to_string(path.join("mokly-static/static/mokly-generated/home/index.mobile.html"))
            .unwrap();
    assert!(html.contains("<p>9007199254740992</p>"));
}

#[test]
fn unsafe_saved_integers_round_before_schema_validation_and_match_viewer_props() {
    let root = consumer::project(&[(
        "specs/number.screen.html",
        "---
title: Number
propSchema:
  type: object
  additionalProperties: false
  properties:
    count: {type: integer, maximum: 9007199254740992}
props: {count: 9007199254740993}
variants:
  - {slug: negative, title: Negative, props: {count: -9007199254740993}}
  - {slug: safe, title: Safe, props: {count: 9007199254740991}}
---
<p>{{count}}</p>",
    )]);
    let path = root.path();
    let built = build(path, false);
    assert_eq!(built.code, Some(0), "{}", built.stderr);
    assert_eq!(
        count(&built.stderr, "outside the JavaScript safe integer range"),
        3,
        "{}",
        built.stderr
    );
    let catalogue = index(path);
    let screens = catalogue["screens"].as_array().unwrap();
    assert_eq!(
        wire_number(&screens[0]["props"], "count"),
        9_007_199_254_740_992.0
    );
    assert_eq!(
        wire_number(&screens[1]["props"], "count"),
        -9_007_199_254_740_992.0
    );
    assert_eq!(
        wire_number(&screens[2]["props"], "count"),
        9_007_199_254_740_991.0
    );
    let document = fs::read_to_string(
        path.join("mokly-static/static/mokly-generated/number/index.mobile.html"),
    )
    .unwrap();
    assert!(document.contains("<p>9007199254740992</p>"));
    let strict = build(path, true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert!(strict.stderr.contains("3 build warnings with --strict"));
}
