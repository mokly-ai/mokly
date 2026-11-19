//! Editor files preserve exact plans while selectable and hidden candidates invalidate them.

use std::fs;

use super::plan_support::Fixture;
use super::support::link_directory;

#[test]
fn editor_file_additions_keep_checked_plans_and_native_results() {
    editor_changes(false);
}

#[test]
fn editor_file_removals_keep_checked_plans_and_native_results() {
    editor_changes(true);
}

fn editor_changes(remove: bool) {
    let mut fixture = Fixture::new();
    let names = [".value.ts.swp", "value.ts~"];
    if remove {
        for name in names {
            fixture.write(name, "editor data");
        }
    }
    fixture.prepare();
    assert_eq!(fixture.attempts(), 2);
    fixture.edit();
    for name in names {
        if remove {
            fs::remove_file(fixture.root().join(name)).unwrap();
        } else {
            fixture.write(name, "editor data");
        }
    }
    fixture.write("value.ts", "export const value='edited';");
    assert_eq!(fixture.prepare(), ["entry.ts", "value.ts"]);
    assert!(fixture.sent_plan(), "remove={remove}");
    assert_eq!(fixture.attempts(), 3, "remove={remove}");
    fixture.assert_native();
}

#[test]
fn selectable_and_hidden_preferred_candidates_reject_plans_and_match_native_results() {
    for (name, specifier, initial, target, expected) in [
        (
            "extension",
            "./value",
            "value.ts",
            "value.tsx",
            ["entry.ts", "value.tsx"],
        ),
        (
            "hidden directory",
            "./lib/item",
            "lib/item/index.js",
            "lib/item.ts",
            ["entry.ts", "lib/item.ts"],
        ),
        (
            "extension-only file",
            "./.js",
            ".tsx",
            ".ts",
            [".ts", "entry.ts"],
        ),
        (
            "extension-only directory",
            "./.js",
            ".js/index.ts",
            ".ts",
            [".ts", "entry.ts"],
        ),
    ] {
        let mut fixture = Fixture::new();
        fixture.write("entry.ts", &format!("export {{value}} from {specifier:?};"));
        fixture.write(initial, "export const value='original';");
        fixture.prepare();
        fixture.edit();
        fixture.write(target, "export const value='preferred';");
        fixture.write(
            "entry.ts",
            &format!("export {{value}} from {specifier:?}; export const edited=1;"),
        );
        assert_eq!(fixture.prepare(), expected, "{name}");
        assert!(!fixture.sent_plan(), "{name}");
        assert_eq!(fixture.attempts(), 4, "{name}");
        fixture.assert_native();
    }
}

#[test]
fn added_modules_keep_current_plans_but_stale_candidates_reject_them() {
    for stale in [false, true] {
        let mut fixture = Fixture::new();
        fixture.prepare();
        fixture.edit();
        fixture.write("added.ts", "export const extra='added';");
        fixture.write(
            "entry.ts",
            "export {value} from './value'; export {extra} from './added.ts';",
        );
        if stale {
            fixture.write("value.tsx", "export const value='preferred';");
        }
        let value = if stale { "value.tsx" } else { "value.ts" };
        assert_eq!(fixture.prepare(), ["added.ts", "entry.ts", value]);
        assert_eq!(fixture.sent_plan(), !stale, "stale={stale}");
        assert_eq!(
            fixture.attempts(),
            if stale { 4 } else { 3 },
            "stale={stale}"
        );
        fixture.assert_native();
    }
}

#[test]
fn added_catalogue_entries_keep_only_current_plans_and_native_results() {
    for stale in [false, true] {
        let mut fixture = Fixture::new();
        fixture.prepare();
        fixture.edit();
        fixture.write("extra_entry.ts", "export const extra='entry';");
        if stale {
            fixture.write("value.tsx", "export const value='preferred';");
        }
        let value = if stale { "value.tsx" } else { "value.ts" };
        assert_eq!(
            fixture.prepare_entries(&["entry.ts", "extra_entry.ts"]),
            ["entry.ts", "extra_entry.ts", value],
        );
        assert_eq!(fixture.sent_plan(), !stale, "stale={stale}");
        assert_eq!(fixture.attempts(), if stale { 4 } else { 3 });
        fixture.assert_native();
    }
}

#[test]
fn an_unrelated_broken_link_rejects_the_plan_and_keeps_native_results() {
    let mut fixture = Fixture::new();
    fs::create_dir(fixture.root().join("ignored_target")).unwrap();
    link_directory(
        &fixture.root().join("ignored_target"),
        &fixture.root().join("ignored_link"),
    );
    fixture.prepare();
    fixture.edit();
    fs::remove_dir(fixture.root().join("ignored_target")).unwrap();
    fixture.write("value.ts", "export const value='edited';");
    assert_eq!(fixture.prepare(), ["entry.ts", "value.ts"]);
    assert!(!fixture.sent_plan());
    assert_eq!(fixture.attempts(), 4);
    fixture.assert_native();
}

#[test]
fn a_current_plan_error_matches_native_and_never_retries() {
    let mut fixture = Fixture::new();
    fixture.prepare();
    fixture.edit();
    fixture.write("value.ts", "export const value = ;");
    let error = fixture.try_prepare(&["entry.ts"]).unwrap_err().to_string();
    assert!(error.contains("Unexpected"), "{error}");
    assert!(fixture.sent_plan());
    assert_eq!(fixture.attempts(), 3);
    fixture.assert_native();
}
