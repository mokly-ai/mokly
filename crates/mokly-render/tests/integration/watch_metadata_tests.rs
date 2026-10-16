//! Bundle reuse includes resolved React metadata and absent Storybook preview candidates.

use std::fs;

use mokly_sidecar::operations::Operation;

use super::support::Consumer;

#[test]
fn preview_addition_and_removal_invalidate_reused_bundle_definitions() {
    let consumer = Consumer::single();
    let first = consumer.prepare().unwrap();
    let initial = first.javascript.generation.as_ref().unwrap().id.clone();
    assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
    fs::create_dir(consumer.root().join(".storybook")).unwrap();
    let path = consumer.root().join(".storybook/preview.ts");
    fs::write(
        &path,
        "export default { globals: { watchProof: 'added' } };",
    )
    .unwrap();
    let added = consumer.prepare().unwrap();
    assert_ne!(initial, added.javascript.generation.as_ref().unwrap().id);
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
    fs::remove_file(path).unwrap();
    let removed = consumer.prepare().unwrap();
    assert_eq!(initial, removed.javascript.generation.as_ref().unwrap().id);
    assert_eq!(
        consumer.processes.count(Operation::Esbuild),
        2,
        "retained initial compilation is reusable after removal"
    );
}

#[test]
fn resolved_react_manifest_digest_invalidates_an_html_only_rebuild() {
    let consumer = Consumer::single();
    let config = consumer.root().join("mokly.config.json");
    let mut input: serde_json::Value = serde_json::from_slice(&fs::read(&config).unwrap()).unwrap();
    input["moduleResolution"] = serde_json::json!({"aliases":{"react/package.json":"react-metadata/package.json"}, "packageRoots":["metadata"]});
    fs::write(&config, serde_json::to_vec(&input).unwrap()).unwrap();
    let metadata = consumer
        .root()
        .join("metadata/node_modules/react-metadata/package.json");
    fs::create_dir_all(metadata.parent().unwrap()).unwrap();
    fs::write(consumer.root().join("metadata/package.json"), "{}").unwrap();
    fs::write(&metadata, r#"{"version":"test-a"}"#).unwrap();
    let first = consumer.prepare().unwrap();
    let old = first.javascript.generation.as_ref().unwrap().id.clone();
    assert_eq!(consumer.processes.count(Operation::Esbuild), 1);
    fs::write(metadata, r#"{"version":"test-b"}"#).unwrap();
    consumer.replace(
        "specs/mixed.screen.html",
        "<h1>Mixed</h1>",
        "<h1>Edited</h1>",
    );
    let changed = consumer.prepare().unwrap();
    assert_ne!(old, changed.javascript.generation.as_ref().unwrap().id);
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
}
