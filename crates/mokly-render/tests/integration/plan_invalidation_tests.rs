//! Real filesystem changes permit direct plans only while resolution facts match.

use std::fs;

use super::plan_capture::InitialCapture;
use super::plan_support::Fixture;
use super::support::{link_directory, unlink_directory, workspace};

#[test]
fn serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes() {
    let target = workspace().join("target");
    fs::create_dir_all(&target).unwrap();
    let directory = tempfile::tempdir_in(target).unwrap();
    for name in [
        "content",
        "existing import",
        "new module",
        "index priority",
        "package type",
        "exports",
        "sideEffects",
        "paths",
        "link",
    ] {
        let mut fixture = Fixture::in_parent(directory.path());
        match name {
            "existing import" => fixture.write("existing.ts", "export const extra=1;"),
            "index priority" => {
                fixture.write("entry.ts", "export {value} from './lib/item';");
                fixture.write("lib/item/index.js", "export const value='index';");
            }
            "package type" | "exports" | "sideEffects" => {
                fixture.write("entry.ts", "export {value} from 'chosen';");
                fixture.write(
                    "node_modules/chosen/package.json",
                    r#"{"name":"chosen","exports":"./one.js","sideEffects":true}"#,
                );
                fixture.write("node_modules/chosen/one.js", "export const value='one';");
                fixture.write("node_modules/chosen/two.js", "export const value='two';");
            }
            "paths" => {
                fixture.write("entry.ts", "export {value} from 'chosen';");
                fixture.write("one/value.ts", "export const value='one';");
                fixture.write("two/value.ts", "export const value='two';");
                fixture.write(
                    "tsconfig.json",
                    r#"{"compilerOptions":{"strict":true,"paths":{"chosen":["./one/value.ts"]}}}"#,
                );
            }
            "link" => {
                fixture.write("entry.ts", "export {value} from './alias';");
                fixture.write("old/index.ts", "export const value='old';");
                fixture.write("new/index.ts", "export const value='new';");
                link_directory(&fixture.root().join("old"), &fixture.root().join("alias"));
            }
            _ => {}
        }
        fixture.prepare();
        assert_eq!(
            fixture.initial_capture(),
            Some(InitialCapture {
                complete: true,
                durable: true,
                uncaptured: None,
                plan: true,
                toolchain: true,
            }),
            "initial capture {name}"
        );
        assert_eq!(fixture.attempts(), 2, "initial {name}");
        fixture.edit();
        let expected = match name {
            "content" => {
                fixture.write("value.ts", "export const value='edited';");
                vec!["entry.ts", "value.ts"]
            }
            "existing import" => {
                fixture.write(
                    "entry.ts",
                    "export {value} from './value.ts'; export {extra} from './existing.ts';",
                );
                vec!["entry.ts", "existing.ts", "value.ts"]
            }
            "new module" => {
                fixture.write("added.ts", "export const extra=1;");
                fixture.write("entry.ts", "export {extra} from './added.ts';");
                vec!["added.ts", "entry.ts"]
            }
            "index priority" => {
                fixture.write("lib/item/index.ts", "export const value='preferred';");
                vec!["entry.ts", "lib/item/index.ts"]
            }
            "package type" => {
                fixture.write(
                    "node_modules/chosen/package.json",
                    r#"{"name":"chosen","exports":"./one.js","sideEffects":true,"type":"module"}"#,
                );
                vec!["entry.ts", "node_modules/chosen/one.js"]
            }
            "exports" => {
                fixture.write(
                    "node_modules/chosen/package.json",
                    r#"{"name":"chosen","exports":"./two.js","sideEffects":true}"#,
                );
                vec!["entry.ts", "node_modules/chosen/two.js"]
            }
            "sideEffects" => {
                fixture.write(
                    "node_modules/chosen/package.json",
                    r#"{"name":"chosen","exports":"./one.js","sideEffects":false}"#,
                );
                vec!["entry.ts", "node_modules/chosen/one.js"]
            }
            "paths" => {
                fixture.write(
                    "tsconfig.json",
                    r#"{"compilerOptions":{"strict":true,"paths":{"chosen":["./two/value.ts"]}}}"#,
                );
                vec!["entry.ts", "two/value.ts"]
            }
            "link" => {
                unlink_directory(&fixture.root().join("alias"));
                link_directory(&fixture.root().join("new"), &fixture.root().join("alias"));
                vec!["entry.ts", "new/index.ts"]
            }
            _ => unreachable!(),
        };
        assert_eq!(fixture.prepare(), expected, "modules {name}");
        let direct = name == "content" || name == "existing import";
        assert_eq!(
            fixture.sent_plan(),
            direct,
            "plan {name}, initial capture: {:?}",
            fixture.initial_capture()
        );
        assert_eq!(
            fixture.attempts(),
            if direct { 3 } else { 4 },
            "attempts {name}"
        );
    }
}

#[test]
fn serve_plans_reject_an_added_earlier_absolute_paths_target() {
    let scratch = workspace().join(".context");
    fs::create_dir_all(&scratch).unwrap();
    let directory = tempfile::tempdir_in(scratch).unwrap();
    let mut fixture = Fixture::in_parent(directory.path());
    let written = fixture
        .root()
        .join("written.js")
        .to_string_lossy()
        .replace('\\', "/");
    fixture.write("one/.keep", "");
    fixture.write("two/value.js", "export const value='two';");
    fixture.write(
        "entry.ts",
        &format!(
            "export {{value}} from {};",
            serde_json::to_string(&written).unwrap()
        ),
    );
    fixture.write("tsconfig.json", &serde_json::to_string(&serde_json::json!({
        "compilerOptions": { "strict": true, "paths": { written: ["./one/value.js", "./two/value.js"] } }
    })).unwrap());
    assert_eq!(fixture.prepare(), ["entry.ts", "two/value.js"]);
    assert_eq!(fixture.attempts(), 2);
    fixture.edit();
    assert_eq!(fixture.prepare(), ["entry.ts", "two/value.js"]);
    assert!(
        fixture.sent_plan(),
        "unchanged resolution must use the saved plan"
    );
    assert_eq!(fixture.attempts(), 2);
    fixture.write("one/value.js", "export const value='one';");
    let changed = fixture.prepare();
    assert!(
        !fixture.sent_plan(),
        "an earlier mapped target must reject the saved plan"
    );
    assert_eq!(changed, ["entry.ts", "one/value.js"]);
    assert_eq!(fixture.attempts(), 4);
}
