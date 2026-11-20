//! Cached nested dependency inputs map to the installation selected by this delivery.

use std::fs;
use std::path::Path;
use std::sync::Arc;

use mokly_graph::types::RenderGeneration;
use mokly_test_support::capture::Trace;

use super::support::{Consumer, link_directory, unlink_directory};

const CSS: &str = ".theme {\n  color: red;\n}\n";

fn generation(consumer: &Consumer, misses: &[&str]) -> Arc<dyn RenderGeneration> {
    let trace = Trace::default();
    let generation = trace.in_scope(|| consumer.generation(consumer.prepare().unwrap()));
    let bundles: Vec<_> = trace
        .spans()
        .into_iter()
        .filter(|span| span.name == "css.bundle")
        .map(|span| span.fields["cache"].clone())
        .collect();
    assert_eq!(bundles, misses);
    let css = generation
        .resource("styles/packages/x/theme.css")
        .unwrap()
        .unwrap();
    assert_eq!(String::from_utf8(css).unwrap(), CSS);
    generation
}

fn name(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[test]
fn cached_nested_dependency_watch_inputs_follow_relinked_external_installations() {
    let mut consumer = Consumer::single();
    consumer.runtime = Arc::new((*consumer.runtime).clone().with_resolution_watching());
    consumer.without_installation();
    fs::create_dir(consumer.root().join("node_modules")).unwrap();
    consumer.write(
        "mokly.config.json",
        r#"{
          "roots":[{"dir":"specs","files":["**/*.screen.html"]}],
          "stylesheets":[{"match":"**","stylesheets":["packages/x/theme.css"]}]
        }"#,
    );
    consumer.write(
        "specs/mixed.screen.html",
        "---\ntitle: Home\n---\n<p>Home</p>\n",
    );
    consumer.write("packages/x/theme.css", "@import 'fixture-theme/tokens';\n");
    let one = tempfile::tempdir().unwrap();
    let two = tempfile::tempdir().unwrap();
    for installation in [one.path(), two.path()] {
        fs::create_dir(installation.join("fixture-theme")).unwrap();
        fs::write(installation.join("fixture-theme/package.json"), "{}").unwrap();
        fs::write(installation.join("fixture-theme/tokens.css"), CSS).unwrap();
    }
    let linked = consumer.root().join("packages/x/node_modules");
    link_directory(one.path(), &linked);
    let first = generation(&consumer, &["no-record"]);
    let selected = dunce::canonicalize(one.path()).unwrap();
    let candidate = name(&selected.join("fixture-theme/package.json"));
    assert_eq!(
        first.stylesheet_resolution_roots().get(&candidate),
        Some(&selected),
        "roots: {:?}; files: {:?}",
        first.stylesheet_resolution_roots(),
        first.stylesheet_resolution_files()
    );
    let cached = generation(&consumer, &[]);
    assert_eq!(
        cached.stylesheet_resolution_roots(),
        first.stylesheet_resolution_roots()
    );

    unlink_directory(&linked);
    link_directory(two.path(), &linked);
    let switched = generation(&consumer, &[]);
    let selected = dunce::canonicalize(two.path()).unwrap();
    let candidate = name(&selected.join("fixture-theme/package.json"));
    assert_eq!(
        switched.stylesheet_resolution_roots().get(&candidate),
        Some(&selected)
    );
    assert!(switched.stylesheet_resolution_files().contains(&candidate));
    assert!(
        !switched
            .stylesheet_resolution_files()
            .iter()
            .any(|file| Path::new(file).starts_with(one.path()))
    );
}
