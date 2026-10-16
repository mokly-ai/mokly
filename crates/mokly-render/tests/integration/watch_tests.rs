//! Watched generations count bundle and render work without elapsed-time assertions.

use std::collections::BTreeMap;
use std::fs;
use std::sync::Arc;

use mokly_graph::cache::Artifact;
use mokly_graph::types::RenderGeneration;
use mokly_sidecar::methods::Call;
use mokly_sidecar::operations::Operation;

use super::support::Consumer;

fn documents(generation: &dyn RenderGeneration) -> BTreeMap<String, Arc<Artifact>> {
    generation
        .plans()
        .keys()
        .map(|route| (route.clone(), generation.render(route).unwrap()))
        .collect()
}
fn calls(consumer: &Consumer) -> (usize, usize, usize) {
    let calls = consumer.pool.calls.lock().unwrap();
    (
        consumer.processes.count(Operation::Esbuild),
        calls
            .iter()
            .filter(|call| {
                matches!(
                    call,
                    Call::RenderScreen(_)
                        | Call::RenderComponent(_)
                        | Call::RenderPage(_)
                        | Call::RenderStory(_)
                )
            })
            .count(),
        calls
            .iter()
            .filter(|call| matches!(call, Call::ProcessCss(_)))
            .count(),
    )
}

#[test]
fn html_and_css_edits_reuse_javascript_and_unchanged_document_nodes() {
    let consumer = Consumer::single();
    let first = consumer.generation(consumer.prepare().unwrap());
    let original = documents(first.as_ref());
    let initial = calls(&consumer);
    assert_eq!(initial.0, 1);
    assert!(initial.1 > 0 && initial.2 > 0);
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 1);
    assert_eq!(consumer.processes.count(Operation::PostcssStop), 0);
    consumer.replace(
        "specs/mixed.screen.html",
        "<h1>Mixed</h1>",
        "<h1>Edited</h1>",
    );
    let second = consumer.generation(consumer.prepare().unwrap());
    let edited = documents(second.as_ref());
    assert_eq!(calls(&consumer), initial);
    let changed: Vec<_> = edited
        .iter()
        .filter(|(path, bytes)| !Arc::ptr_eq(&original[*path], bytes))
        .map(|(path, _)| path.as_str())
        .collect();
    assert_eq!(changed.len(), 4);
    assert!(changed.iter().all(|path| path.starts_with("mixed/")));
    assert!(String::from_utf8_lossy(&edited["mixed/index.mobile.html"].bytes).contains("Edited"));
    consumer.replace("shared.css", "color:", "background-color:");
    let third = consumer.generation(consumer.prepare().unwrap());
    let styles = third.resource("styles/renderer.tsx.css").unwrap().unwrap();
    assert!(String::from_utf8_lossy(&styles).contains("background-color"));
    let _ = documents(third.as_ref());
    let after = calls(&consumer);
    assert_eq!((after.0, after.1), (initial.0, initial.1));
    assert_eq!(after.2, initial.2 + 1);
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 2);
    assert_eq!(consumer.processes.count(Operation::PostcssStop), 0);
    drop(first);
    drop(second);
    drop(third);
    consumer.processes.wait_for(Operation::PostcssStop, 2);
}

#[test]
fn javascript_edit_bundles_once_and_leaves_pure_html_documents_cached() {
    let consumer = Consumer::single();
    fs::write(
        consumer.root().join("specs/plain.screen.html"),
        "---\ntitle: Plain\n---\n<p>Native</p>",
    )
    .unwrap();
    let first = consumer.generation(consumer.prepare().unwrap());
    let original = documents(first.as_ref());
    let initial = calls(&consumer);
    consumer.replace("specs/screen.mockup.tsx", "Hello", "Changed");
    let second = consumer.generation(consumer.prepare().unwrap());
    let next = documents(second.as_ref());
    assert_eq!(calls(&consumer).0, initial.0 + 1);
    assert_eq!(calls(&consumer).1, initial.1 * 2);
    assert!(Arc::ptr_eq(
        &original["plain/index.mobile.html"],
        &next["plain/index.mobile.html"]
    ));
    assert!(String::from_utf8_lossy(&next["screen/index.mobile.html"].bytes).contains("Changed"));
    assert_eq!(consumer.processes.count(Operation::PostcssStart), 1);
    assert_eq!(consumer.processes.count(Operation::PostcssStop), 0);
    drop(first);
    drop(second);
    consumer.processes.wait_for(Operation::PostcssStop, 1);
}

#[test]
fn lazy_resources_change_documents_without_rendering_another_fragment() {
    let consumer = Consumer::single();
    let first = consumer.generation(consumer.prepare().unwrap());
    let _ = documents(first.as_ref());
    let initial = calls(&consumer);
    let second = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(
        first.plans()["screen/index.mobile.html"].key,
        second.plans()["screen/index.mobile.html"].key
    );
    consumer.replace("assets/banner.svg", "svg", "svg data-revised=\"yes\"");
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert_ne!(
        first.plans()["screen/index.mobile.html"].key,
        changed.plans()["screen/index.mobile.html"].key
    );
    let _ = documents(changed.as_ref());
    assert_eq!(calls(&consumer), initial);
}

#[test]
fn added_and_removed_html_sources_preserve_other_keys() {
    let consumer = Consumer::single();
    fs::write(
        consumer.root().join("specs/plain.screen.html"),
        "---\ntitle: Plain\n---\n<p>Native</p>",
    )
    .unwrap();
    let first = consumer.generation(consumer.prepare().unwrap());
    let original = documents(first.as_ref());
    let initial = calls(&consumer);
    let path = consumer.root().join("specs/added.screen.html");
    fs::write(&path, "---\ntitle: Added\n---\n<p>Added entry</p>").unwrap();
    let added = consumer.generation(consumer.prepare().unwrap());
    assert!(added.plans().contains_key("added/index.mobile.html"));
    assert!(Arc::ptr_eq(
        &original["plain/index.mobile.html"],
        &added.render("plain/index.mobile.html").unwrap()
    ));
    fs::remove_file(path).unwrap();
    let removed = consumer.generation(consumer.prepare().unwrap());
    assert!(!removed.plans().contains_key("added/index.mobile.html"));
    assert_eq!(calls(&consumer), (initial.0 + 2, initial.1, initial.2));
}

#[test]
fn burst_changes_bundle_once_and_root_configuration_reuses_compilation() {
    let consumer = Consumer::single();
    let first = consumer.generation(consumer.prepare().unwrap());
    let _ = documents(first.as_ref());
    let initial = calls(&consumer);
    assert_eq!(initial.0, 1);
    consumer.replace("specs/screen.mockup.tsx", "Hello", "Burst");
    consumer.replace(
        "specs/mixed.screen.html",
        "<h1>Mixed</h1>",
        "<h1>Burst HTML</h1>",
    );
    consumer.replace("shared.css", "color:", "background-color:");
    let burst = consumer.generation(consumer.prepare().unwrap());
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
    assert!(
        String::from_utf8_lossy(&burst.render("screen/index.mobile.html").unwrap().bytes)
            .contains("Burst")
    );
    consumer.replace(
        "mokly.config.json",
        "\"dir\": \"specs\"",
        "\"dir\": \"specs\", \"path\": \"nested\"",
    );
    let configured = consumer.generation(consumer.prepare().unwrap());
    assert!(
        configured
            .plans()
            .contains_key("nested/screen/index.mobile.html")
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
}
