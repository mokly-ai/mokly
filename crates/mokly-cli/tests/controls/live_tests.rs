//! Live edits of unsafe numbers keep their binary64 values through Serve (Unix).

#![cfg(unix)]

use std::path::Path;

use mokly_test_support::consumer;
use mokly_test_support::http;
use mokly_test_support::readers;
use mokly_test_support::serve::{self, Serve};
use serde_json::{Value, json};

use super::support::{build, mokly};

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
