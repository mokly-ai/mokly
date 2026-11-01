//! HTML unsafe integer warnings keep each component invocation identity.

use std::fs;
use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

#[test]
fn html_unsafe_integer_warnings_name_each_entry_and_component_instance() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/counter.component.html"),
        "---\ntitle: Counter\nelement: ui-counter\npropSchema: {type: object, additionalProperties: false, properties: {count: {type: integer}}}\n---\n<p>{{count}}</p>",
    )
    .unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\n---\n<ui-counter count='9007199254740993'></ui-counter><ui-counter mokly-instance='second' count='9007199254740995'></ui-counter>",
    )
    .unwrap();
    fs::write(
        root.path().join("specs/away.screen.html"),
        "---\ntitle: Away\nprops: {count: 9007199254740993}\n---\n{{count}}<ui-counter count='9007199254740993'></ui-counter>",
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes", "--out", "site"])
        .current_dir(root.path())
        .env("MOKLY_OUTPUT", "plain")
        .env("PATH", "")
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/warning] entry \"away\": component \"counter\" instance \"counter\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value\n[mokly/warning] entry \"away\": prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value\n[mokly/warning] entry \"home\": component \"counter\" instance \"counter\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value\n[mokly/warning] entry \"home\": component \"counter\" instance \"second\" prop \"/count\" is outside the JavaScript safe integer range and uses the nearest binary64 value\n"
    );
}
