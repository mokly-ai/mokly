//! Physical-only metadata must invalidate the core's bundle shortcut.

use std::collections::BTreeMap;

use mokly_sidecar::methods::Call;

use super::support::{Consumer, link_directory, workspace};

#[test]
fn a_jsconfig_edit_reaches_the_sidecar_instead_of_the_bundle_fast_path() {
    let fixture = Consumer::single();
    fixture.write("jsconfig.json", r#"{"compilerOptions":{}}"#);
    let original = fixture.generation(fixture.prepare().unwrap());
    let bundle_calls = || {
        fixture
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::Bundle(_)))
            .count()
    };
    let before = bundle_calls();
    assert!(before > 0);
    fixture.prepare().unwrap();
    assert_eq!(bundle_calls(), before);
    fixture.write(
        "jsconfig.json",
        r#"{"compilerOptions":{"alwaysStrict":true}}"#,
    );
    let changed = fixture.prepare().unwrap();
    assert!(
        bundle_calls() > before,
        "physical metadata must reach the bundle input check"
    );
    assert_ne!(
        changed.javascript.generation.as_ref().unwrap().id,
        original
            .catalogue()
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .id
    );
}

#[test]
fn incomplete_compilations_get_fresh_ids_and_descriptions() {
    let fixture = Consumer::single();
    fixture.write("extra-config.json", r#"{"compilerOptions":{}}"#);
    let extension = fixture.root().join("extra-config.json");
    fixture.write(
        "tsconfig.json",
        &serde_json::to_string(&BTreeMap::from([("extends", extension)])).unwrap(),
    );
    let original = fixture.generation(fixture.prepare().unwrap());
    let describe_calls = || {
        fixture
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::Describe(_)))
            .count()
    };
    let before = describe_calls();
    assert!(before > 0);
    fixture.write(
        "extra-config.json",
        r#"{"compilerOptions":{"alwaysStrict":true}}"#,
    );
    let changed = fixture.prepare().unwrap();
    assert!(
        describe_calls() > before,
        "incomplete compilation must describe again"
    );
    assert_ne!(
        changed.javascript.generation.as_ref().unwrap().id,
        original
            .catalogue()
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .id
    );
}

#[test]
fn a_peer_manifest_edit_gets_a_new_generation_and_description() {
    let fixture = Consumer::single();
    fixture.without_installation();
    fixture.write("installation/package.json", "{}");
    link_directory(
        &workspace().join("node_modules"),
        &fixture.root().join("installation/node_modules"),
    );
    fixture.replace(
        "mokly.config.json",
        r#""postcss": "postcss.mjs""#,
        r#""postcss": "postcss.mjs", "moduleResolution": {"packageRoots":["installation"]}"#,
    );
    fixture.write(
        "node_modules/@emotion/server/create-instance/index.js",
        "module.exports={};",
    );
    fixture.write(
        "node_modules/@emotion/server/create-instance/package.json",
        r#"{"main":"index.js"}"#,
    );
    fixture.write(
        "node_modules/@emotion/server/package.json",
        r#"{"name":"@emotion/server","version":"1"}"#,
    );
    let original = fixture.generation(fixture.prepare().unwrap());
    let describe_calls = || {
        fixture
            .pool
            .calls
            .lock()
            .unwrap()
            .iter()
            .filter(|call| matches!(call, Call::Describe(_)))
            .count()
    };
    let before = describe_calls();
    assert!(before > 0);
    fixture.prepare().unwrap();
    assert_eq!(describe_calls(), before);
    fixture.write(
        "node_modules/@emotion/server/package.json",
        r#"{"name":"@emotion/server","version":"2"}"#,
    );
    let changed = fixture.prepare().unwrap();
    assert!(
        describe_calls() > before,
        "a changed peer must describe again"
    );
    assert_ne!(
        changed.javascript.generation.as_ref().unwrap().id,
        original
            .catalogue()
            .javascript
            .generation
            .as_ref()
            .unwrap()
            .id
    );
}
