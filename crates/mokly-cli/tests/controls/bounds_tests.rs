//! Control bounds warn before strict failure, number steps must fit, and control order holds.

use std::fs;

use mokly_test_support::consumer;
use mokly_test_support::files::write;
use mokly_test_support::readers;
use serde_json::Value;

use super::support::{build, count, index, index_bytes};

fn component(step: &str, multiple: u32, value: u32) -> String {
    format!(
        "
import React from 'react';
import {{defineComponent}} from '@mokly/mokly';
export default defineComponent({{path:'count',title:'Count',description:'',relatedDocs:[],
  propSchema:{{type:'object',additionalProperties:false,properties:{{count:{{type:'integer',multipleOf:{multiple}}}}}}},
  props:{{count:{value}}},controls:{{count:{{kind:'number',minimum:0,maximum:4,step:{step}}}}},
  variants:[{{slug:'valid',title:'Valid',props:{{count:0}}}}],
  render:({{count}})=>React.createElement('p',null,count)}});
"
    )
}

#[test]
fn saved_props_and_story_args_outside_control_bounds_warn_before_strict_failure() {
    let root = consumer::project(&[
        ("specs/count.mockup.ts", &component("2", 2, 6)),
        (
            "specs/story.stories.ts",
            "import React from 'react';
      export default {title:'Count story',component:({count})=>React.createElement('p',null,count),
        args:{count:8},argTypes:{count:{control:{min:0,max:4,step:2}}}};
      export const Saved = {args:{count:6}};
      export const Valid = {args:{count:2}};",
        ),
    ]);
    let path = root.path();
    let built = build(path, false);
    assert_eq!(built.code, Some(0), "{}", built.stderr);
    assert_eq!(
        count(&built.stderr, "outside its control bounds"),
        3,
        "{}",
        built.stderr
    );
    assert!(built.stderr.contains("component \"count\""));
    assert!(built.stderr.contains("component \"story/Saved\""));
    assert!(!built.stderr.contains("\"count/valid\""));
    assert!(!built.stderr.contains("\"story/Valid\""));
    let previous = index_bytes(path);
    readers::index(&previous);
    let strict = build(path, true);
    assert_eq!(strict.code, Some(1), "{}", strict.stderr);
    assert!(strict.stderr.contains("3 build warnings with --strict"));
    assert_eq!(index_bytes(path), previous);
}

#[test]
fn declared_number_steps_must_fit_integer_types_and_schema_multiples() {
    let root = consumer::project(&[]);
    let path = root.path();
    for (step, multiple, value) in [("3", 2, 0), ("0.5", 1, 0), ("6", 2, 0)] {
        write(
            path,
            "specs/count.mockup.ts",
            component(step, multiple, value),
        );
        let result = build(path, false);
        let accepted = step == "6";
        assert_eq!(
            result.code,
            Some(if accepted { 0 } else { 1 }),
            "{}",
            result.stderr
        );
        if !accepted {
            assert!(
                result.stderr.contains("component-controls"),
                "{}",
                result.stderr
            );
        }
    }
}

#[test]
fn entry_details_retain_declared_schema_and_inferred_control_order() {
    let root = consumer::project(&[
        (
            "specs/html.screen.html",
            "---
title: HTML
propSchema: {type: object, additionalProperties: false, properties: {zulu: {type: string}, alpha: {type: number}}}
props: {alpha: 1, zulu: Saved}
variants: [{slug: other, title: Other, props: {alpha: 2}}]
---
<p>{{zulu}} {{alpha}}</p>",
        ),
        (
            "specs/entries.mockup.ts",
            "import React from 'react'; import {defineScreen} from '@mokly/mokly';
      const render = () => React.createElement('p',null,'Order');
      export const declared = defineScreen({path:'declared',title:'Declared',description:'',relatedDocs:[],
        props:{alpha:1,zulu:1},controls:{zulu:{kind:'number'},alpha:{kind:'number'}},render});
      export const inferred = defineScreen({path:'inferred',title:'Inferred',description:'',relatedDocs:[],
        props:{zulu:1,alpha:1},variants:[{slug:'other',title:'Other',props:{middle:true}}],render});
      export const schema = defineScreen({path:'schema',title:'Schema',description:'',relatedDocs:[],
        propSchema:{type:'object',additionalProperties:false,properties:{zulu:{type:'number'},alpha:{type:'number'}}},
        props:{alpha:1,zulu:1},render});",
        ),
        (
            "specs/story.stories.ts",
            "import React from 'react';
      export default {title:'Story',component:()=>React.createElement('p',null,'Story'),args:{zulu:1,alpha:1}};
      export const Other = {args:{middle:true}};",
        ),
    ]);
    let path = root.path();
    let result = build(path, false);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    let catalogue = index(path);
    let output = path.join("mokly-static/mokly-viewer");
    for (name, expected) in [
        ("html", vec!["zulu", "alpha"]),
        ("html/other", vec!["zulu", "alpha"]),
        ("declared", vec!["zulu", "alpha"]),
        ("schema", vec!["zulu", "alpha"]),
        ("inferred", vec!["zulu", "alpha", "middle"]),
        ("inferred/other", vec!["zulu", "alpha", "middle"]),
        ("story", vec!["zulu", "alpha", "middle"]),
        ("story/Other", vec!["zulu", "alpha", "middle"]),
    ] {
        let detail =
            readers::detail(&fs::read(output.join(format!("entries/{name}.json"))).unwrap());
        assert_eq!(
            detail["controlOrder"],
            serde_json::json!(expected),
            "{name}"
        );
        let entry = ["screens", "components"]
            .iter()
            .flat_map(|kind| catalogue[*kind].as_array().unwrap())
            .find(|entry| entry["path"] == name)
            .unwrap();
        let controls = entry["controls"].as_object().unwrap();
        let keys: Vec<&str> = expected
            .iter()
            .copied()
            .filter(|key| controls.contains_key(*key))
            .collect();
        assert_eq!(
            keys,
            expected,
            "{name}: {}",
            Value::Object(controls.clone())
        );
    }
}
