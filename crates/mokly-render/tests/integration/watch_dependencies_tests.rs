//! HTML components, configuration, and PostCSS membership invalidate their consumers.

use std::fs;
use std::sync::Arc;

use mokly_sidecar::methods::Call;
use mokly_sidecar::operations::Operation;

use super::support::Consumer;

fn html() -> Consumer {
    let consumer = Consumer::single();
    fs::remove_dir_all(consumer.root().join("specs")).unwrap();
    fs::create_dir(consumer.root().join("specs")).unwrap();
    fs::write(consumer.root().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        consumer.root().join("specs/card.component.html"),
        "---\ntitle: Card\nelement: ui-card\npropSchema: { type: object, additionalProperties: false, properties: {}, required: [] }\nprops: {}\n---\n<strong>Original</strong>",
    )
    .unwrap();
    fs::write(
        consumer.root().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<ui-card></ui-card>",
    )
    .unwrap();
    fs::write(
        consumer.root().join("specs/plain.screen.html"),
        "---\ntitle: Plain\n---\n<p>Independent</p>",
    )
    .unwrap();
    consumer
}

#[test]
fn html_component_edit_changes_only_its_own_and_consumer_documents() {
    let consumer = html();
    let first = consumer.generation(consumer.prepare().unwrap());
    let plain = first.render("plain/index.mobile.html").unwrap();
    let old = first.render("home/index.mobile.html").unwrap();
    consumer.replace("specs/card.component.html", "Original", "Replacement");
    let second = consumer.generation(consumer.prepare().unwrap());
    assert!(Arc::ptr_eq(
        &plain,
        &second.render("plain/index.mobile.html").unwrap()
    ));
    assert_ne!(
        old.bytes,
        second.render("home/index.mobile.html").unwrap().bytes
    );
    assert_eq!(
        first
            .plans()
            .iter()
            .filter(|(path, plan)| plan.key != second.plans()[*path].key)
            .count(),
        4
    );
    assert!(consumer.pool.calls.lock().unwrap().is_empty());
    assert_eq!(consumer.processes.count(Operation::Esbuild), 0);
}

#[test]
fn postcss_directory_add_remove_and_config_edits_recompute_the_expected_nodes() {
    let consumer = html();
    fs::create_dir(consumer.root().join("candidates")).unwrap();
    fs::write(consumer.root().join("theme.css"), "p { color: red }").unwrap();
    fs::write(consumer.root().join("postcss.mjs"), r#"import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export default {plugins:[{postcssPlugin:'candidates',Once(root,{result}) {
 const dir = fileURLToPath(new URL('./candidates',import.meta.url));
 result.messages.push({type:'dir-dependency',plugin:'candidates',dir,glob:'**/*.txt'});
 root.append({selector:'.candidate-count',nodes:[{prop:'--count',value:String(fs.readdirSync(dir).filter(name=>name.endsWith('.txt')).length)}]});
}}]};"#).unwrap();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
    )
    .unwrap();
    let count = || {
        consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::ProcessCss(_)))
            .count()
    };
    let first = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(count(), 1);
    fs::write(consumer.root().join("candidates/unrelated.bin"), "ignored").unwrap();
    let same = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(count(), 1);
    assert_eq!(
        first.plans()["home/index.mobile.html"].key,
        same.plans()["home/index.mobile.html"].key
    );
    let file = consumer.root().join("candidates/added.txt");
    fs::write(&file, "added").unwrap();
    let added = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(count(), 2);
    assert!(
        String::from_utf8_lossy(&added.resource("styles/theme.css").unwrap().unwrap())
            .contains("--count: 1")
    );
    fs::remove_file(&file).unwrap();
    let removed = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(count(), 3);
    assert!(
        !removed
            .catalogue()
            .model
            .sources
            .contains(&"candidates/added.txt".into())
    );
    consumer.replace(
        "mokly.config.json",
        "\"postcss\"",
        "\"colorSchemes\":[\"light\",\"dark\"],\"postcss\"",
    );
    let config = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(count(), 4);
    assert_eq!(consumer.processes.count(Operation::Esbuild), 0);
    assert!(config.plans().contains_key("home/index.mobile.dark.html"));
    assert_ne!(
        removed.plans()["home/index.mobile.html"].key,
        config.plans()["home/index.mobile.html"].key
    );
}

#[test]
fn temporary_resources_do_not_join_the_catalogue_watch_set() {
    let consumer = html();
    fs::copy(
        consumer.root().join("assets/banner.svg"),
        consumer.root().join("assets/temporary.svg"),
    )
    .unwrap();
    fs::write(consumer.root().join("specs/plain.screen.html"), "---\ntitle: Plain\nprops: { image: ../../assets/banner.svg }\n---\n<img src=\"{{image}}\">").unwrap();
    let generation = consumer.generation(consumer.prepare().unwrap());
    generation.render("plain/index.mobile.html").unwrap();
    let before = generation.watch_files();
    assert!(before.contains("assets/banner.svg"));
    let props = serde_json::from_str(r#"{"image":"../../assets/temporary.svg"}"#).unwrap();
    let temporary = generation
        .render_props("plain/index.mobile.html", &props)
        .unwrap();
    assert!(temporary.closure.files.contains("assets/temporary.svg"));
    assert_eq!(generation.watch_files(), before);
}

#[test]
fn unchanged_postcss_output_keeps_unrelated_document_keys() {
    let consumer = html();
    fs::write(consumer.root().join("theme.css"), "strong {color: red}").unwrap();
    fs::write(consumer.root().join("postcss.mjs"), r#"import {fileURLToPath} from 'node:url';
export default {plugins:[{postcssPlugin:'scan',Once(root,{result}){result.messages.push({type:'dependency',plugin:'scan',file:fileURLToPath(new URL('./specs/home.screen.html',import.meta.url))});}}]};"#).unwrap();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
    )
    .unwrap();
    let first = consumer.generation(consumer.prepare().unwrap());
    let original = first.render("plain/index.mobile.html").unwrap();
    consumer.replace(
        "specs/home.screen.html",
        "<ui-card></ui-card>",
        "<ui-card></ui-card><p>Changed text</p>",
    );
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert!(Arc::ptr_eq(
        &original,
        &changed.render("plain/index.mobile.html").unwrap()
    ));
    assert_eq!(
        first
            .plans()
            .iter()
            .filter(|(path, plan)| plan.key != changed.plans()[*path].key)
            .count(),
        2
    );
    assert_eq!(
        consumer
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::ProcessCss(_)))
            .count(),
        2
    );
}

#[test]
fn broad_rebuild_rules_do_not_override_owned_html_inputs() {
    let consumer = html();
    fs::write(
        consumer.root().join("mokly.config.json"),
        r#"{"watch":{"rules":[{"action":"rebuild","paths":["**/*"]}]}}"#,
    )
    .unwrap();
    let first = consumer.generation(consumer.prepare().unwrap());
    consumer.replace(
        "specs/home.screen.html",
        "<ui-card></ui-card>",
        "<ui-card></ui-card><p>Edited</p>",
    );
    let owned = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(
        first
            .plans()
            .iter()
            .filter(|(path, plan)| plan.key != owned.plans()[*path].key)
            .count(),
        2
    );
    fs::write(consumer.root().join("tokens.json"), "custom rule input").unwrap();
    let rule = consumer.generation(consumer.prepare().unwrap());
    assert!(
        owned
            .plans()
            .iter()
            .all(|(path, plan)| plan.key != rule.plans()[path].key)
    );
}
