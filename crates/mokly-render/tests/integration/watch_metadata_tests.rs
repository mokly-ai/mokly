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

#[test]
fn ancestor_manifests_and_tsconfig_creation_changes_and_removal_invalidate_reuse() {
    for name in ["package.json", "tsconfig.json"] {
        let consumer = Consumer::single();
        let original = consumer.prepare().unwrap();
        let initial = original.javascript.generation.as_ref().unwrap().id.clone();
        let path = consumer.root().join("specs").join(name);
        fs::write(&path, "{}").unwrap();
        let added = consumer.prepare().unwrap();
        assert_ne!(initial, added.javascript.generation.as_ref().unwrap().id);
        assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
        assert!(
            added
                .javascript
                .generation
                .as_ref()
                .unwrap()
                .resolution_files
                .contains(&format!("specs/{name}"))
        );
        fs::write(&path, r#"{"compilerOptions":{},"name":"fixture"}"#).unwrap();
        let changed = consumer.prepare().unwrap();
        assert_ne!(
            added.javascript.generation.as_ref().unwrap().id,
            changed.javascript.generation.as_ref().unwrap().id
        );
        assert_eq!(consumer.processes.count(Operation::Esbuild), 3);
        fs::remove_file(&path).unwrap();
        let removed = consumer.prepare().unwrap();
        assert_eq!(initial, removed.javascript.generation.as_ref().unwrap().id);
        assert_eq!(consumer.processes.count(Operation::Esbuild), 3);
    }
}

#[test]
fn a_new_shadowing_module_and_its_removal_change_rendered_output() {
    let consumer = Consumer::single();
    consumer.replace(
        "specs/screen.mockup.tsx",
        "<h1>{props.label}</h1>",
        "<h1>{label}</h1>",
    );
    let path = consumer.root().join("specs/screen.mockup.tsx");
    let source = fs::read_to_string(&path).unwrap();
    fs::write(path, format!("import {{label}} from './value';\n{source}")).unwrap();
    fs::write(
        consumer.root().join("specs/value.js"),
        "export const label='Original';",
    )
    .unwrap();
    let original = consumer.generation(consumer.prepare().unwrap());
    assert!(
        String::from_utf8_lossy(&original.render("screen/index.mobile.html").unwrap().bytes)
            .contains("Original")
    );
    fs::write(
        consumer.root().join("specs/value.ts"),
        "export const label='Shadow';",
    )
    .unwrap();
    let changed = consumer.generation(consumer.prepare().unwrap());
    assert!(
        String::from_utf8_lossy(&changed.render("screen/index.mobile.html").unwrap().bytes)
            .contains("Shadow")
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
    fs::remove_file(consumer.root().join("specs/value.ts")).unwrap();
    let removed = consumer.generation(consumer.prepare().unwrap());
    assert!(
        String::from_utf8_lossy(&removed.render("screen/index.mobile.html").unwrap().bytes)
            .contains("Original")
    );
    assert_eq!(consumer.processes.count(Operation::Esbuild), 2);
}
