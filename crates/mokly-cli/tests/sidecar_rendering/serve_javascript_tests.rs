//! Serve renders JavaScript live props safely, and renderer-only catalogues keep source private.

#![cfg(unix)]

use std::fs;

use mokly_test_support::consumer;
use mokly_test_support::http;
use mokly_test_support::serve::{self, Serve, Stream};
use regex::Regex;
use serde_json::{Value, json};
use url::Url;

use super::support::mokly;

const COMPONENT: &str = "import React from 'react'; import {defineComponent,defineScreen} from '@mokly/mokly';
let renders=0;
export const card=defineComponent({path:'card',element:'ui-card',title:'Card',description:'',relatedDocs:[],
propSchema:{type:'object',additionalProperties:false,properties:{label:{type:'string'},count:{type:'integer'}},required:['label','count']},
props:{label:'Saved',count:2},slots:['children'],controls:{label:{kind:'text',maxLength:5},count:{kind:'number',minimum:0,maximum:4,step:2}},
render:(props)=>React.createElement('button',{'data-render':++renders},props.label+':'+props.count,props.children)});
export const home=defineScreen({path:'home',title:'Home',description:'',relatedDocs:[],props:{label:'Saved'},
render:(props)=>React.createElement(card.Component,{label:props.label,count:2},React.createElement('em',null,'React slot'))});";

fn json_body(reply: &http::Reply) -> Value {
    serde_json::from_slice(&reply.body).unwrap()
}

#[test]
fn serve_renders_javascript_live_props_with_the_shared_renderer_css_token_and_revision_fence() {
    let config = json!({
        "renderer": "renderer.mjs",
        "postcss": "postcss.mjs",
        "stylesheets": [{ "match": "**", "stylesheets": ["style.css"] }],
    })
    .to_string();
    let root = consumer::project(&[
        ("mokly.config.json", &config),
        ("specs/entries.mockup.ts", COMPONENT),
        (
            "specs/html.screen.html",
            "---\ntitle: HTML\n---\n<ui-card label=\"HTML\" count=\"2\"><b>HTML slot</b></ui-card>",
        ),
        (
            "renderer.mjs",
            "import React from 'react'; export default ({node})=>React.createElement('section',{'data-provider':'consumer'},node);",
        ),
        (
            "postcss.mjs",
            "export default {plugins:[{postcssPlugin:'colors',Declaration(decl){if(decl.value==='MOKLY_COLOR') decl.value='blue'}}]};",
        ),
        ("style.css", "button { color: MOKLY_COLOR }"),
    ]);
    let mut running = Serve::start(&mokly(), root.path(), &[]);
    let url = running.ready();
    let (index, detail) = serve::completed(&url, "card");
    assert_eq!(index["changesStatus"], "unavailable");
    let used_by = detail["workspace"]["usedBy"].as_array().unwrap();
    for entry in ["home", "html"] {
        assert!(
            used_by.iter().any(|used| used["entryPath"] == entry),
            "{entry}"
        );
    }
    let slot = Regex::new("<!--mokly-slot:start ([^>]+)-->").unwrap();
    let receiver = Regex::new(r#"instance="(r-\d+)""#).unwrap();
    for route in ["home", "html"] {
        let bytes = http::get(
            &url,
            &format!("/static/mokly-generated/{route}/index.mobile.html"),
        )
        .text();
        let slots: Vec<_> = slot.captures_iter(&bytes).collect();
        assert!(!slots.is_empty(), "{bytes}");
        for found in slots {
            let id = &receiver
                .captures(&found[1])
                .unwrap_or_else(|| panic!("{}", &found[0]))[1];
            assert!(
                bytes.contains(&format!("<!--mokly-instance:start id=\"{id}\"")),
                "{}",
                &found[0]
            );
        }
    }
    let saved_path = "/static/mokly-generated/card/index.mobile.html";
    let saved = http::get(&url, saved_path).text();
    assert!(saved.contains("Saved:2"));
    assert!(saved.contains("data-provider=\"consumer\""));
    let live = json_body(&http::get(&url, "/mokly-viewer/live.json"));
    let token = live["render"]["token"].as_str().unwrap();
    let render_path = live["render"]["url"].as_str().unwrap();
    let revision = index["revision"].as_i64().unwrap();
    let body = json!({
        "entryPath": "card",
        "viewport": "mobile",
        "colorScheme": "light",
        "revision": revision,
        "pageId": "a".repeat(32),
        "overrides": { "label": { "kind": "set", "value": "Edit" }, "count": { "kind": "set", "value": 4 } },
    });
    let render = |input: &Value, token: &str, origin: &str| {
        http::post(
            &url,
            render_path,
            &[
                ("content-type", "application/json"),
                ("origin", origin),
                ("x-mokly-render-token", token),
            ],
            input.to_string().as_bytes(),
        )
    };
    assert_eq!(render(&body, "wrong", &url).status, 403);
    assert_eq!(render(&body, token, "http://example.invalid").status, 403);
    let mut stale_body = body.clone();
    stale_body["revision"] = json!(revision - 1);
    let stale = render(&stale_body, token, &url);
    assert_eq!(stale.status, 409);
    assert_eq!(json_body(&stale)["code"], "stale-revision");
    for overrides in [
        json!({ "label": { "kind": "set", "value": "Too long" }, "count": { "kind": "set", "value": 2 } }),
        json!({ "label": { "kind": "set", "value": "Edit" }, "count": { "kind": "set", "value": 3 } }),
        json!({ "label": { "kind": "unset" }, "count": { "kind": "set", "value": 2 } }),
    ] {
        let mut invalid = body.clone();
        invalid["overrides"] = overrides;
        assert_eq!(render(&invalid, token, &url).status, 400);
    }
    let response = render(&body, token, &url);
    assert_eq!(response.status, 200, "{}", response.text());
    let preview = json_body(&response);
    assert_eq!(preview["revision"], revision);
    assert_eq!(preview["usage"]["status"], "ready");
    let preview_url = preview["previewUrl"].as_str().unwrap();
    let html = http::get(&url, preview_url).text();
    assert!(html.contains("Edit:4"));
    assert!(html.contains("data-provider=\"consumer\""));
    let href = Regex::new(r#"<link[^>]*href="([^"]+)""#).unwrap();
    let stylesheet = href.captures(&html).unwrap_or_else(|| panic!("{html}"))[1].to_owned();
    let resolved = Url::parse(&format!("{url}{preview_url}"))
        .unwrap()
        .join(&stylesheet)
        .unwrap();
    let css = http::get(&url, resolved.path());
    assert_eq!(css.status, 200);
    assert!(Regex::new("blue|#00f").unwrap().is_match(&css.text()));
    let repeat = json_body(&render(&body, token, &url));
    assert_eq!(
        http::get(&url, repeat["previewUrl"].as_str().unwrap()).text(),
        html
    );
    assert_eq!(http::get(&url, saved_path).text(), saved);
    let after = json_body(&http::get(&url, "/mokly-viewer/index.json"));
    assert_eq!(after, index);
    let finished = running.close();
    let git_failure = Regex::new(r"^\[mokly/git-failed\] [^\n]+\n$").unwrap();
    assert!(
        git_failure.is_match(&finished.stderr),
        "{}",
        finished.stderr
    );
}

#[test]
fn renderer_only_catalogues_inventory_imported_source_in_serve_and_build() {
    let root = consumer::project(&[
        ("mokly.config.json", r#"{"renderer":"renderer.mjs"}"#),
        (
            "renderer.mjs",
            "import './helper.js'; export default ({node})=>node;",
        ),
        ("helper.js", "export const secret='private source';"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<a href=\"../../helper.js\">Helper</a>",
        ),
    ]);
    let path = root.path();
    let built = mokly()
        .command(path, &["build", "--no-changes"], "plain")
        .run();
    assert_eq!(built.code, Some(1));
    let protected = Regex::new(r"protected target .*helper\.js").unwrap();
    assert!(protected.is_match(&built.stderr), "{}", built.stderr);
    assert!(!built.stderr.contains("JavaScript renderer is unavailable"));
    let mut running = Serve::start(&mokly(), path, &[]);
    let url = running.ready();
    assert_eq!(http::get(&url, "/static/helper.js").status, 404);
    let rendered = http::get(&url, "/static/mokly-generated/home/index.mobile.html");
    assert_eq!(rendered.status, 500);
    running.wait(Stream::Stderr, &protected);
    running.close();
    assert_eq!(
        fs::read_to_string(path.join("helper.js")).unwrap(),
        "export const secret='private source';"
    );
}
