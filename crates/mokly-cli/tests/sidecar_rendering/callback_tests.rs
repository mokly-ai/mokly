//! React callbacks: impure slot children, and pages that bypass the screen renderer.

use std::fs;

use mokly_test_support::changes;
use mokly_test_support::files::write;
use mokly_test_support::timings::timings;
use regex::Regex;

use super::support::{CALLBACK_ENTRY, CALLBACK_PRELUDE, callback_consumer, mokly};

fn slots(impure: bool) -> String {
    let label = if impure {
        "String(++calls)"
    } else {
        "'Stable'"
    };
    format!(
        "
export const leaf = defineComponent({{...metadata,path:'leaf',title:'Leaf',
  propSchema:{{type:'object',additionalProperties:false,required:['label'],properties:{{label:{{type:'string'}}}}}},
  props:{{label:'Own'}},render:props=><b>{{props.label}}</b>}});
export const pane = defineComponent({{...metadata,path:'pane',title:'Pane',
  propSchema:{{type:'object',additionalProperties:false,properties:{{}}}},slots:['children'],
  render:props=><section>{{props.children}}{{props.children}}</section>}});
let calls=0;
function Vary(){{return <leaf.Component label={{{label}}}/>;}}
export const screen = defineScreen({{...metadata,path:'screen',title:'Screen',
  render:()=> <pane.Component><Vary/></pane.Component>}});
"
    )
}

#[test]
fn repeated_react_slots_reject_conflicting_inputs_from_an_impure_child_and_retain_pure_replay() {
    let root = callback_consumer(&slots(true), &[]);
    let path = root.path();
    let rejected = mokly()
        .command(
            path,
            &[
                "build",
                "--no-changes",
                "--sidecars=1",
                "--out=.context/site",
            ],
            "plain",
        )
        .run();
    assert_eq!(rejected.code, Some(1), "{}", rejected.stderr);
    let conflict = Regex::new("conflicting fragment input [a-f0-9]{64}").unwrap();
    assert!(conflict.is_match(&rejected.stderr), "{}", rejected.stderr);
    assert!(!path.join(".context/site").exists());
    write(
        path,
        CALLBACK_ENTRY,
        format!("{CALLBACK_PRELUDE}{}", slots(false)),
    );
    let ready = changes::build(
        &mokly(),
        path,
        &["--no-changes", "--sidecars=1", "--strict"],
        "plain",
    );
    for viewport in ["mobile", "desktop"] {
        for scheme in ["", ".dark"] {
            let html = fs::read_to_string(ready.output.join(format!(
                "static/mokly-generated/screen/index.{viewport}{scheme}.html"
            )))
            .unwrap();
            assert_eq!(html.matches("<b>Stable</b>").count(), 2);
        }
    }
}

const DOCUMENT_SECOND: &str = "<!doctype html><html><head><title>Handbook</title></head><body><main>Second: call 1</main></body></html>";

#[test]
fn a_static_build_renders_a_page_through_its_imported_helper_once_and_bypasses_the_screen_renderer()
{
    let helper = format!(
        "let calls=0; export function renderDocument(){{\n  if(++calls!==1) throw new Error('repeated page helper call');\n  return {};\n}}",
        serde_json::json!(DOCUMENT_SECOND)
    );
    let root = callback_consumer(
        "
import {renderDocument} from '../document.source';
export const page=definePage({...metadata,path:'handbook',title:'Handbook',render:renderDocument});
",
        &[
            (
                "mokly.config.json",
                r#"{"renderer":"renderer.ts","colorSchemes":["light","dark"]}"#,
            ),
            ("document.source.ts", &helper),
            (
                "renderer.ts",
                "export default () => {throw new Error('screen renderer must not render pages');};",
            ),
        ],
    );
    let ready = changes::build(
        &mokly(),
        root.path(),
        &[
            "--no-changes",
            "--strict",
            "--sidecars=1",
            "--debug-timings",
        ],
        "plain",
    );
    let pages: Vec<_> = ready.index["pages"]
        .as_array()
        .unwrap()
        .iter()
        .map(|page| page["path"].as_str().unwrap())
        .collect();
    assert_eq!(pages, ["handbook"]);
    let directory = ready.output.join("static/mokly-generated/handbook");
    let names: Vec<_> = fs::read_dir(&directory)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, ["index.html"]);
    let html = fs::read_to_string(directory.join("index.html")).unwrap();
    assert!(html.contains("Second: call 1"));
    let renders: Vec<_> = timings(&ready.finished.stderr)
        .into_iter()
        .filter(|record| {
            record.field("role") == "sidecar"
                && record.stage() == "sidecar.render"
                && record.event() == "end"
        })
        .collect();
    assert_eq!(renders.len(), 1);
    assert_eq!(renders[0].field("kind"), "page");
    assert_eq!(renders[0].status(), Some("ok"));
}
