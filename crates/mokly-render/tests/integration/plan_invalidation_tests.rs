//! Real filesystem changes permit direct plans only while resolution facts match.

use super::plan_support::Fixture;
use super::support::{link_directory, unlink_directory};

#[test]
fn serve_edit_plans_follow_content_import_candidate_manifest_configuration_and_link_changes() {
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
        let mut fixture = Fixture::new();
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
        assert_eq!(fixture.sent_plan(), direct, "plan {name}");
        assert_eq!(
            fixture.attempts(),
            if direct { 3 } else { 4 },
            "attempts {name}"
        );
    }
}
