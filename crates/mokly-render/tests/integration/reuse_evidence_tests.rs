//! Physical-only metadata must invalidate the core's bundle shortcut.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use mokly_model::material::digest;
use mokly_render::physical_inputs::{PhysicalInputs, SystemPhysicalInputs};
use mokly_sidecar::compiled::{PhysicalEntry, PhysicalEntryKind, PhysicalInput};
use mokly_sidecar::methods::Call;

use super::support::{Consumer, link_directory, workspace};

#[test]
fn dangling_links_match_their_absent_lexical_target_and_reject_replacement_or_retargeting() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    let candidate = root.join("candidate.ts");
    let intermediate = root.join("intermediate.ts");
    let target = root.join("missing.ts");
    fs::create_dir(root.join("nested")).unwrap();
    link_file(Path::new("./intermediate.ts"), &candidate);
    link_file(Path::new("./nested/../missing.ts"), &intermediate);
    let expected = PhysicalInput::Link {
        target: target.to_str().unwrap().into(),
    };
    let inputs = BTreeMap::from([
        (candidate.to_str().unwrap().into(), expected.clone()),
        (target.to_str().unwrap().into(), PhysicalInput::Absent),
    ]);
    let current = || {
        inputs.iter().all(|(path, input)| {
            SystemPhysicalInputs
                .matches(Path::new(path), input, &inputs)
                .unwrap()
        })
    };
    assert!(
        current(),
        "a dangling link with its absent lexical final target must match"
    );
    assert!(
        !SystemPhysicalInputs
            .matches(&candidate, &expected, &BTreeMap::new())
            .unwrap(),
        "a failed canonical path must not match without an adjacent absent entry"
    );
    assert!(
        !SystemPhysicalInputs
            .matches(&candidate, &PhysicalInput::Absent, &inputs)
            .unwrap(),
        "recorded absence must still use lstat and reject a dangling link"
    );
    fs::remove_file(&intermediate).unwrap();
    link_file(Path::new("./other.ts"), &intermediate);
    assert!(!current());
    fs::remove_file(&intermediate).unwrap();
    link_file(Path::new("./missing.ts"), &intermediate);
    assert!(current());
    fs::write(&target, "export {};").unwrap();
    assert!(!current());
    fs::remove_file(&target).unwrap();
    fs::remove_file(&candidate).unwrap();
    fs::write(&candidate, "export {};").unwrap();
    assert!(!current());
}

fn link_file(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(target, link).unwrap();
}

#[test]
fn canonical_file_records_reject_an_introduced_source_directory_link() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    let text = "export {value} from '../value.ts';";
    fs::create_dir(root.join("chosen")).unwrap();
    fs::create_dir_all(root.join("changed/nested")).unwrap();
    fs::write(root.join("chosen/source.ts"), text).unwrap();
    fs::write(root.join("changed/nested/source.ts"), text).unwrap();
    fs::write(root.join("value.ts"), "export const value='old';").unwrap();
    fs::write(root.join("changed/value.ts"), "export const value='new';").unwrap();
    let file = root.join("chosen/source.ts");
    let records = [
        (file.clone(), PhysicalInput::FilePath),
        (
            file.clone(),
            PhysicalInput::File {
                digest: digest(text.as_bytes()),
            },
        ),
        (
            root.join("chosen"),
            PhysicalInput::Directory {
                entries: vec![PhysicalEntry {
                    name: "source.ts".into(),
                    kind: PhysicalEntryKind::File,
                    target: None,
                }],
            },
        ),
    ];
    let matches = || {
        records.each_ref().map(|(path, record)| {
            SystemPhysicalInputs
                .matches(path, record, &BTreeMap::new())
                .unwrap()
        })
    };
    assert_eq!(matches(), [true, true, true]);
    fs::rename(root.join("chosen"), root.join("retained")).unwrap();
    link_directory(&root.join("changed/nested"), &root.join("chosen"));
    assert_eq!(matches(), [false, false, false]);
}

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
