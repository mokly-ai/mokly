//! Real Serve startup and edit attempts own prepared PostCSS contexts.

use std::fs;
use std::sync::Arc;

use mokly_render::runtime::Runtime;
use mokly_sidecar::methods::{BundleCapture, Call};
use mokly_sidecar::operations::Operation;

use super::support::Consumer;

fn page(label: &str, imported: bool) -> String {
    format!(
        "import {{definePage}} from '@mokly/mokly';{}export default definePage({{title:'Page',description:'Page',relatedDocs:[],render:()=>'<!doctype html><html><head><title>Page</title></head><body><p>{label}</p></body></html>'}});",
        if imported {
            "import '../theme.css';"
        } else {
            ""
        }
    )
}

pub(super) fn fixture(configured: bool) -> Consumer {
    let consumer = Consumer::single();
    fs::remove_dir_all(consumer.root().join("specs")).unwrap();
    consumer.write("mokly.config.json", if configured {
        r#"{"roots":[{"dir":"specs"}],"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#
    } else {
        r#"{"roots":[{"dir":"specs"}],"postcss":"postcss.mjs"}"#
    });
    consumer.write("specs/page.mockup.ts", &page("Original", !configured));
    consumer.write("theme.css", "p { color: red }\n");
    consumer.write("postcss.mjs", "import {fileURLToPath} from 'node:url';export default {plugins:[{postcssPlugin:'attempt',Once(root,{result}){result.messages.push({type:'dependency',plugin:'attempt',file:fileURLToPath(new URL('./specs/page.mockup.ts',import.meta.url))});}}]};");
    consumer
}

fn preparations(consumer: &Consumer, after: usize) -> Vec<String> {
    consumer.pool.calls.lock().unwrap()[after..]
        .iter()
        .filter_map(|call| match call {
            Call::Bundle(request) => request
                .preparation
                .as_ref()
                .map(|preparation| preparation.context.clone()),
            _ => None,
        })
        .collect()
}

pub(super) fn releases(consumer: &Consumer, context: &str) -> usize {
    consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter(|call| matches!(call, Call::DisposeContext(params) if params.context == context))
        .count()
}

fn startup(consumer: &mut Consumer) {
    let runtime = consumer.runtime.as_ref();
    consumer.runtime = Arc::new(
        Runtime::new(
            runtime.tree.clone(),
            runtime.dependency_tree.clone(),
            runtime.physical_inputs.clone(),
            runtime.pool.clone(),
            runtime.cache.clone(),
            runtime.workers.clone(),
            runtime.version.clone(),
            None,
        )
        .with_serve_edit_plans()
        .with_stylesheet_watching(),
    );
}

#[test]
fn startup_uses_full_capture_and_one_context_for_configured_stylesheets() {
    let mut consumer = fixture(true);
    let build = consumer.generation(consumer.prepare().unwrap());
    let expected = build.resource("styles/theme.css").unwrap().unwrap();
    startup(&mut consumer);
    let before = consumer.pool.calls.lock().unwrap().len();
    let prepared = consumer.prepare().unwrap();
    let contexts = preparations(&consumer, before);
    assert_eq!(contexts.len(), 1);
    let captures: Vec<_> = consumer.pool.calls.lock().unwrap()[before..]
        .iter()
        .filter_map(|call| match call {
            Call::Bundle(request) => Some(request.capture),
            _ => None,
        })
        .collect();
    assert_eq!(captures, [Some(BundleCapture::Full)]);
    assert_eq!(releases(&consumer, &contexts[0]), 0);
    let generation = consumer.generation(prepared);
    let requests: Vec<_> = consumer.pool.calls.lock().unwrap()[before..]
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.context.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(requests, contexts);
    let actual = generation.resource("styles/theme.css").unwrap().unwrap();
    assert_eq!(actual, b"p {\n  color: red;\n}\n");
    assert_eq!(actual, expected);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
    consumer.processes.wait_for(Operation::PostcssStop, 1);
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 2);
    drop(generation);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
}

#[test]
fn startup_without_a_postcss_root_releases_its_unused_preparation() {
    let mut consumer = fixture(false);
    consumer.write("specs/page.mockup.ts", &page("Without CSS", false));
    startup(&mut consumer);
    let prepared = consumer.prepare().unwrap();
    let contexts = preparations(&consumer, 0);
    assert_eq!(contexts.len(), 1);
    assert_eq!(releases(&consumer, &contexts[0]), 0);
    let generation = consumer.generation(prepared);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
    let requests: Vec<_> = consumer
        .pool
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.context.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(requests, Vec::<String>::new());
    assert!(
        String::from_utf8_lossy(&generation.render("page/index.html").unwrap().bytes)
            .contains("Without CSS")
    );
    drop(generation);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
}

#[test]
fn startup_bundle_failure_releases_its_new_preparation() {
    let mut consumer = fixture(false);
    startup(&mut consumer);
    consumer.write("specs/page.mockup.ts", "export default {");
    let failure = consumer.prepare().unwrap_err();
    assert!(matches!(
        failure,
        mokly_catalogue::error::CatalogueError::Runtime { .. }
    ));
    let contexts = preparations(&consumer, 0);
    assert_eq!(contexts.len(), 1);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
}

#[test]
fn unused_preparation_ends_when_the_attempt_publishes_a_retained_graph() {
    let mut consumer = fixture(false);
    let original = consumer.generation(consumer.prepare().unwrap());
    Arc::make_mut(&mut consumer.runtime).bundle_capture = BundleCapture::ServeEdit;
    let before = consumer.pool.calls.lock().unwrap().len();
    consumer.write("specs/page.mockup.ts", &page("Without CSS", false));
    let prepared = consumer.prepare().unwrap();
    let contexts = preparations(&consumer, before);
    assert_eq!(contexts.len(), 1);
    assert_eq!(releases(&consumer, &contexts[0]), 0);
    let retained = consumer.generation(prepared);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
    assert!(
        String::from_utf8_lossy(&retained.render("page/index.html").unwrap().bytes)
            .contains("Without CSS")
    );
    assert!(
        String::from_utf8_lossy(&original.render("page/index.html").unwrap().bytes)
            .contains("Original")
    );
}

#[test]
fn configured_stylesheets_use_preparation_before_its_attempt_guard_finishes() {
    let mut consumer = fixture(true);
    let original = consumer.generation(consumer.prepare().unwrap());
    Arc::make_mut(&mut consumer.runtime).bundle_capture = BundleCapture::ServeEdit;
    let before = consumer.pool.calls.lock().unwrap().len();
    consumer.write("specs/page.mockup.ts", &page("Configured", false));
    let prepared = consumer.prepare().unwrap();
    let contexts = preparations(&consumer, before);
    assert_eq!(contexts.len(), 1);
    assert_eq!(releases(&consumer, &contexts[0]), 0);
    let generation = consumer.generation(prepared);
    let requests: Vec<_> = consumer.pool.calls.lock().unwrap()[before..]
        .iter()
        .filter_map(|call| match call {
            Call::ProcessCss(params) => Some(params.context.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(requests, contexts);
    assert_eq!(
        generation.resource("styles/theme.css").unwrap().unwrap(),
        b"p {\n  color: red;\n}\n"
    );
    assert_eq!(releases(&consumer, &contexts[0]), 0);
    drop(generation);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
    assert!(original.resource("styles/theme.css").unwrap().is_some());
}

#[test]
fn bundle_failure_releases_only_the_new_preparation() {
    let mut consumer = fixture(false);
    let original = consumer.generation(consumer.prepare().unwrap());
    Arc::make_mut(&mut consumer.runtime).bundle_capture = BundleCapture::ServeEdit;
    let before = consumer.pool.calls.lock().unwrap().len();
    consumer.write("specs/page.mockup.ts", "export default {");
    let failure = consumer.prepare().unwrap_err();
    assert!(matches!(
        failure,
        mokly_catalogue::error::CatalogueError::Runtime { .. }
    ));
    let contexts = preparations(&consumer, before);
    assert_eq!(contexts.len(), 1);
    assert_eq!(releases(&consumer, &contexts[0]), 1);
    assert!(
        String::from_utf8_lossy(&original.render("page/index.html").unwrap().bytes)
            .contains("Original")
    );
}
