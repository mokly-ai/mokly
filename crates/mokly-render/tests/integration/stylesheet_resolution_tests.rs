//! Head stylesheet records invalidate when resolution selects a different source.

use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use mokly_graph::types::GraphFactory;
use mokly_test_support::capture::Trace;

use super::support::{Consumer, link_directory, unlink_directory};

const BEFORE: &str = ".before {\n  --selection: before;\n}\n";
const AFTER: &str = ".after {\n  --selection: after;\n}\n";

fn consumer(import: &str) -> Consumer {
    let consumer = Consumer::single();
    consumer.without_installation();
    fs::create_dir(consumer.root().join("node_modules")).unwrap();
    consumer.write(
        "mokly.config.json",
        r#"{
          "roots":[{"dir":"specs","files":["**/*.screen.html"]}],
          "moduleResolution":{"resolveExtensions":[".preferred.css",".css"]},
          "stylesheets":[{"match":"**","stylesheets":["theme.css"]}]
        }"#,
    );
    consumer.write(
        "specs/mixed.screen.html",
        "---\ntitle: Resolution\n---\n<p>Resolution</p>\n",
    );
    consumer.write("theme.css", import);
    consumer
}

fn stylesheet(consumer: &Consumer, misses: &[&str]) -> String {
    let trace = Trace::default();
    let css = trace.in_scope(|| {
        let generation = consumer.generation(consumer.prepare().unwrap());
        String::from_utf8(generation.resource("styles/theme.css").unwrap().unwrap()).unwrap()
    });
    let bundles: Vec<_> = trace
        .spans()
        .into_iter()
        .filter(|span| span.name == "css.bundle")
        .map(|span| span.fields["cache"].clone())
        .collect();
    assert_eq!(bundles, misses);
    css
}

fn changed_package_entry(field: &str, original: &str, edited: &str, postcss: bool) {
    let started = Instant::now();
    let consumer = consumer("@import 'fixture-theme';\n");
    if postcss {
        enable_postcss(&consumer);
    }
    consumer.write("node_modules/fixture-theme/package.json", original);
    consumer.write("node_modules/fixture-theme/before.css", BEFORE);
    consumer.write("node_modules/fixture-theme/after.css", AFTER);
    assert_eq!(stylesheet(&consumer, &["no-record"]), BEFORE);
    assert_eq!(stylesheet(&consumer, &[]), BEFORE);

    consumer.write("node_modules/fixture-theme/package.json", edited);
    let actual = stylesheet(&consumer, &["stamp-mismatch"]);
    eprintln!(
        "head package {field} resolution scenario: {:?}",
        started.elapsed()
    );
    assert_eq!(
        actual, AFTER,
        "changed package {field} must select after.css"
    );
}

#[test]
fn head_stylesheet_reselects_changed_package_style() {
    changed_package_entry(
        "style",
        r#"{"name":"fixture-theme","version":"1.0.0","style":"./before.css"}"#,
        r#"{"name":"fixture-theme","version":"1.0.0","style":"./after.css"}"#,
        false,
    );
}

#[test]
fn head_stylesheet_reselects_changed_package_exports() {
    changed_package_entry(
        "exports",
        r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./before.css"}}"#,
        r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./after.css"}}"#,
        false,
    );
}

fn earlier_candidate(postcss: bool) {
    let started = Instant::now();
    let consumer = consumer("@import './tokens';\n");
    if postcss {
        enable_postcss(&consumer);
    }
    consumer.write("tokens.css", BEFORE);
    assert_eq!(stylesheet(&consumer, &["no-record"]), BEFORE);
    assert_eq!(stylesheet(&consumer, &[]), BEFORE);

    consumer.write("tokens.preferred.css", AFTER);
    let actual = stylesheet(&consumer, &["stamp-mismatch"]);
    eprintln!(
        "head earlier candidate resolution scenario: {:?}",
        started.elapsed()
    );
    assert_eq!(
        actual, AFTER,
        "new earlier candidate must select tokens.preferred.css"
    );
}

fn enable_postcss(consumer: &Consumer) {
    consumer.replace(
        "mokly.config.json",
        "\"moduleResolution\":",
        "\"postcss\":\"postcss.mjs\",\"moduleResolution\":",
    );
    consumer.write("postcss.mjs", "export default { plugins: [] };\n");
}

#[test]
fn head_stylesheet_reselects_new_earlier_candidate() {
    earlier_candidate(false);
}

#[test]
fn postcss_stylesheet_reselects_changed_package_style() {
    changed_package_entry(
        "style",
        r#"{"name":"fixture-theme","version":"1.0.0","style":"./before.css"}"#,
        r#"{"name":"fixture-theme","version":"1.0.0","style":"./after.css"}"#,
        true,
    );
}

#[test]
fn postcss_stylesheet_reselects_changed_package_exports() {
    changed_package_entry(
        "exports",
        r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./before.css"}}"#,
        r#"{"name":"fixture-theme","version":"1.0.0","exports":{".":"./after.css"}}"#,
        true,
    );
}

#[test]
fn postcss_stylesheet_reselects_new_earlier_candidate() {
    earlier_candidate(true);
}

#[test]
fn resolution_watch_files_map_missing_virtual_candidates_to_the_selected_root() {
    let mut consumer = consumer("@import 'fixture-theme/tokens';\n");
    consumer.runtime = Arc::new((*consumer.runtime).clone().with_stylesheet_watching());
    consumer.replace(
        "mokly.config.json",
        "\"resolveExtensions\":",
        "\"packageRoots\":[\"vendor\"],\"resolveExtensions\":",
    );
    consumer.write("vendor/package.json", "{}");
    for install in ["one", "two"] {
        consumer.write(
            &format!("vendor/node_modules/.store/{install}/fixture-theme/package.json"),
            "{}",
        );
        consumer.write(
            &format!("vendor/node_modules/.store/{install}/fixture-theme/tokens.css"),
            BEFORE,
        );
    }
    let linked = consumer.root().join("vendor/node_modules/fixture-theme");
    link_directory(
        &consumer
            .root()
            .join("vendor/node_modules/.store/one/fixture-theme"),
        &linked,
    );
    let generation = consumer.generation(consumer.prepare().unwrap());
    let files = generation.stylesheet_resolution_files();
    assert!(
        files.contains("vendor/node_modules/fixture-theme/package.json"),
        "{files:?}"
    );
    assert!(
        files.contains("vendor/node_modules/fixture-theme/tokens.preferred.css"),
        "{files:?}"
    );
    assert!(
        !files.iter().any(|path| path.contains(".mokly-roots")),
        "{files:?}"
    );
    assert_eq!(
        String::from_utf8(generation.resource("styles/theme.css").unwrap().unwrap()).unwrap(),
        BEFORE
    );
    let cached = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(cached.stylesheet_resolution_files(), files);
    unlink_directory(&linked);
    link_directory(
        &consumer
            .root()
            .join("vendor/node_modules/.store/two/fixture-theme"),
        &linked,
    );
    assert_eq!(stylesheet(&consumer, &[]), BEFORE);
    let switched = consumer
        .generation(consumer.prepare().unwrap())
        .stylesheet_resolution_files();
    assert!(
        switched.contains("vendor/node_modules/.store/two/fixture-theme/tokens.preferred.css"),
        "{switched:?}"
    );
    assert!(
        !switched.iter().any(|path| path.contains(".store/one/")),
        "{switched:?}"
    );
}

fn rejected_candidate(path: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink("tokens.preferred.css", path).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file("tokens.preferred.css", path).unwrap();
}

#[test]
fn a_rejected_dependency_candidate_keeps_valid_css_and_its_repair_watch_path() {
    let mut consumer = consumer("@import 'fixture-theme/tokens';\n");
    consumer.runtime = Arc::new((*consumer.runtime).clone().with_stylesheet_watching());
    consumer.write("node_modules/fixture-theme/package.json", "{}");
    consumer.write("node_modules/fixture-theme/tokens.css", BEFORE);
    rejected_candidate(
        &consumer
            .root()
            .join("node_modules/fixture-theme/tokens.preferred.css"),
    );
    let config = consumer.config();
    let prepared = consumer.prepare().unwrap();
    let factory: &dyn GraphFactory = consumer.runtime.as_ref();
    let result = factory
        .create(&config)
        .unwrap()
        .prepare(config, prepared, None);
    let actual = result
        .as_ref()
        .map(|generation| {
            (
                String::from_utf8(generation.resource("styles/theme.css").unwrap().unwrap())
                    .unwrap(),
                generation.stylesheet_resolution_files(),
            )
        })
        .map_err(ToString::to_string);
    assert_eq!(actual.as_ref().map(|(css, _)| css.as_str()), Ok(BEFORE));
    let (_, files) = actual.unwrap();
    assert!(
        files.contains("node_modules/fixture-theme/tokens.preferred.css"),
        "{files:?}"
    );
}
