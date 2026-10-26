//! Builds forward sidecar timing records with separate identities and no authored text.

use std::collections::{BTreeSet, HashMap};
use std::fs;

use mokly_test_support::consumer;
use mokly_test_support::files::{tree, write};
use mokly_test_support::publication;
use mokly_test_support::timings::timings;
use serde_json::{Value, json};

use super::support::mokly;

const ITEMS: &str = "import React from 'react'; import {defineScreen,defineComponent,definePage} from '@mokly/mokly';
console.error('ordinary sidecar diagnostic');
export const screen=defineScreen({path:'screen',title:'Screen',description:'',relatedDocs:[],render:()=>{process.stderr.write('partial-sidecar-progress\\r');return React.createElement('p',{className:'subject'},'Screen')}});
export const component=defineComponent({path:'component',title:'Component',description:'',relatedDocs:[],propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=>React.createElement('b',null,'Component')});
export const page=definePage({path:'page',title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'});";

fn records(stderr: &str, role: &str) -> Vec<Value> {
    timings(stderr)
        .into_iter()
        .map(|record| record.0)
        .filter(|record| record["role"] == role)
        .collect()
}

#[test]
fn build_forwards_sidecar_timings_with_separate_identities_and_unchanged_output() {
    let config = json!({
        "postcss": "postcss.mjs",
        "stylesheets": [{ "match": "**", "stylesheets": ["theme.css"] }],
    })
    .to_string();
    let root = consumer::project(&[
        ("mokly.config.json", &config),
        ("postcss.mjs", "export default {plugins:[]};"),
        ("theme.css", ".subject {color: red}"),
        ("specs/item.mockup.ts", ITEMS),
    ]);
    let path = root.path();
    let root_text = path.display().to_string();
    let mut previous = None;
    for enabled in [false, true] {
        let mut args = vec![
            "build",
            "--no-changes",
            "--sidecars=1",
            "--out=.context/site",
        ];
        if enabled {
            args.push("--debug-timings");
        }
        let result = mokly().command(path, &args, "plain").run();
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert!(result.stderr.contains("ordinary sidecar diagnostic"));
        let output = tree(&path.join(".context/site"));
        if let Some(previous) = &previous {
            assert!(&output == previous, "the output changed with timings");
        }
        previous = Some(output);
        if !enabled {
            assert!(!result.stderr.contains("[mokly:timing]"));
            continue;
        }
        assert!(result.stderr.contains("partial-sidecar-progress\\u000d\n"));
        let core = records(&result.stderr, "core");
        let sidecar = records(&result.stderr, "sidecar");
        assert!(!sidecar.is_empty());
        let spawned: Vec<_> = core
            .iter()
            .filter(|record| record["stage"] == "sidecar.spawn")
            .collect();
        assert_eq!(spawned.len(), 2);
        assert_eq!(spawned[1]["status"], "ok");
        assert!(
            core.iter()
                .any(|record| record["stage"] == "sidecar.operation")
        );
        for stage in [
            "sidecar.bundle",
            "sidecar.describe",
            "sidecar.render",
            "sidecar.process-css",
        ] {
            let selected: Vec<_> = sidecar
                .iter()
                .filter(|record| record["stage"] == stage)
                .collect();
            assert!(
                selected.iter().any(|record| record["event"] == "start"),
                "{stage}"
            );
            assert!(
                selected
                    .iter()
                    .any(|record| record["event"] == "end" && record["status"] == "ok"),
                "{stage}"
            );
        }
        let starts: HashMap<_, _> = sidecar
            .iter()
            .filter(|record| record["event"] == "start")
            .map(|record| (record["id"].to_string(), record))
            .collect();
        for record in &sidecar {
            assert_ne!(record["pid"], core[0]["pid"]);
            assert_ne!(record["session"], core[0]["session"]);
            assert_eq!(record["pid"], sidecar[0]["pid"]);
            assert_eq!(record["session"], sidecar[0]["session"]);
            assert!(!record.to_string().contains(&root_text));
            if record["event"] == "end" {
                assert_eq!(record["stage"], starts[&record["id"].to_string()]["stage"]);
            }
        }
        let kinds: BTreeSet<_> = sidecar
            .iter()
            .filter(|record| record["stage"] == "sidecar.render")
            .map(|record| record["kind"].as_str().unwrap().to_owned())
            .collect();
        assert_eq!(
            kinds,
            BTreeSet::from([
                "screen".to_owned(),
                "component".to_owned(),
                "page".to_owned()
            ])
        );
    }
}

#[test]
fn failed_sidecar_work_ends_its_timing_span_with_error_and_keeps_authored_text_out_of_records() {
    let root = consumer::project(&[(
        "specs/page.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Page',description:'',relatedDocs:[],render(){throw new Error('authored-only-failure')}});",
    )]);
    let result = mokly()
        .command(
            root.path(),
            &[
                "build",
                "--no-changes",
                "--sidecars=1",
                "--out=.context/site",
                "--debug-timings",
            ],
            "plain",
        )
        .run();
    assert_eq!(result.code, Some(1));
    assert!(result.stderr.contains("authored-only-failure"));
    let sidecar = records(&result.stderr, "sidecar");
    assert!(sidecar.iter().any(|record| {
        record["stage"] == "sidecar.render"
            && record["event"] == "end"
            && record["status"] == "error"
    }));
    let text = Value::Array(sidecar).to_string();
    assert!(!text.contains("authored-only-failure"));
    assert!(!text.contains(&root.path().display().to_string()));
}

#[test]
fn forwarded_record_shaped_consumer_lines_redact_secrets_and_terminal_controls() {
    let spoof = "[mokly:timing] {\r\"schemaVersion\":1,\"role\":\"sidecar\",\"session\":\"private/token\u{7f}\u{85}\",\"pid\":123,\"id\":1,\"stage\":\"sidecar.bundle\",\"event\":\"start\",\"elapsedMs\":0,\"encoded\":\"private%2Ftoken\"}";
    let source = format!(
        "import {{definePage}} from '@mokly/mokly'; process.stderr.write({}); export default definePage({{title:'Page',description:'',relatedDocs:[],render:()=>'<!doctype html><html><head></head><body>Page</body></html>'}});",
        json!(format!("{spoof}\n"))
    );
    let root = consumer::project(&[("specs/page.mockup.ts", &source)]);
    let result = mokly()
        .command(
            root.path(),
            &[
                "build",
                "--no-changes",
                "--debug-timings",
                "--sidecars=1",
                "--out=.context/site",
            ],
            "plain",
        )
        .env("MOKLY_TOKEN", "private/token")
        .run();
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(!result.stderr.contains("private/token"));
    assert!(!result.stderr.contains("private%2Ftoken"));
    for control in ['\r', '\u{7f}', '\u{85}'] {
        assert!(!result.stderr.contains(control));
    }
    assert!(
        result
            .stderr
            .contains(r#""session":"[redacted]\u007f\u0085""#)
    );
    assert!(result.stderr.contains(r#""encoded":"[redacted]""#));
    assert!(result.stderr.contains("[mokly:timing] {\\u000d"));
}

#[test]
fn javascript_fragment_spans_include_success_and_failure_without_source_data() {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    for status in ["ok", "error"] {
        let body = if status == "ok" {
            "return '<!doctype html><html><head></head><body><h1>private fragment output</h1></body></html>'"
        } else {
            "throw new Error('private fragment failure')"
        };
        write(
            path,
            "specs/home.mockup.ts",
            format!(
                "\n        import {{ definePage }} from '@mokly/mokly';\n        export default definePage({{ title: 'Home', description: '', relatedDocs: [],\n          render() {{ {body}; }}\n        }});\n      "
            ),
        );
        let result = mokly()
            .command(
                path,
                &[
                    "build",
                    "--no-changes",
                    "--debug-timings",
                    "--out=.context/site",
                ],
                "rich",
            )
            .run();
        if status == "ok" {
            assert_eq!(result.code, Some(0), "{}", result.stderr);
            let html = fs::read_to_string(
                path.join(".context/site/static/mokly-generated/home/index.html"),
            )
            .unwrap();
            assert!(html.contains("private fragment output"));
        } else {
            assert_ne!(result.code, Some(0));
            assert!(result.stderr.contains("private fragment failure"));
        }
        let all: Vec<Value> = timings(&result.stderr)
            .into_iter()
            .map(|record| record.0)
            .collect();
        let fragments: Vec<_> = all
            .iter()
            .filter(|record| record["role"] == "core" && record["stage"] == "render.fragment")
            .collect();
        let events: Vec<_> = fragments
            .iter()
            .map(|record| record["event"].as_str().unwrap())
            .collect();
        assert_eq!(events, ["start", "end"]);
        assert_eq!(fragments[1]["status"], status);
        let parent = all
            .iter()
            .find(|record| record["role"] == "core" && record["id"] == fragments[0]["parentId"])
            .unwrap();
        assert_eq!(parent["stage"], "render.document");
        assert_eq!(parent["session"], fragments[0]["session"]);
        assert!(all.iter().any(|record| {
            record["role"] == "sidecar"
                && record["stage"] == "sidecar.render"
                && record["event"] == "end"
                && record["status"] == status
        }));
        let text = json!(fragments).to_string();
        for private in ["private fragment", "home.mockup", "handle", "props"] {
            assert!(!text.contains(private), "{private}");
        }
    }
}
