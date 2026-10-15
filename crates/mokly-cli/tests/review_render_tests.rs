//! Exact render diagnostics include source locations and appear once per entry.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use tempfile::TempDir;

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"colorSchemes":["light","dark"]}"#,
    );
    root
}

fn run(root: &Path) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes"])
        .current_dir(root)
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_SIDECARS")
        .output()
        .unwrap()
}

fn fails(root: &Path, expected: &str) {
    let output = run(root);
    assert_eq!(
        output.status.code(),
        Some(1),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stdout.is_empty());
    assert_eq!(String::from_utf8(output.stderr).unwrap(), expected);
}

#[test]
fn missing_markdown_links_have_the_link_coordinate_and_no_duplicate_path() {
    let root = fixture();
    write(
        root.path(),
        "specs/notes.md",
        "---\ntitle: Notes\n---\n\nRead [Missing](./missing.md).\n",
    );
    fails(
        root.path(),
        "[mokly/build-invalid] specs/notes.md:5:6: link target ./missing.md does not exist\n",
    );
}

#[test]
fn dynamic_unknown_and_moved_destinations_use_the_protocol_messages_once() {
    let root = fixture();
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\nprops: {target: nowhere}\n---\n<p>Before</p>\n<a href=\"mock:{{target}}\">Go</a>",
    );
    fails(
        root.path(),
        "[mokly/build-invalid] specs/a.screen.html:6:1: [mokly/unknown-link-target] link target nowhere does not exist\n",
    );
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\nprops: {target: old}\n---\n<p>Before</p>\n<a href=\"mock:{{target}}\">Go</a>",
    );
    write(
        root.path(),
        "specs/new.screen.html",
        "---\ntitle: New\nmovedFrom: old\n---\n<p>New</p>",
    );
    fails(
        root.path(),
        "[mokly/build-invalid] specs/a.screen.html:6:1: [mokly/moved-link-target] link target old does not exist; it moved to new\n",
    );
}

#[test]
fn unsafe_url_schemes_name_the_attribute_url_and_source_once() {
    for (body, detail) in [
        (
            "<a href=\"javascript:void(0)\">Go</a>",
            "href on <a> is not an allowed URL: \"javascript:void(0)\"",
        ),
        (
            "<a href=\"sms:123\">Go</a>",
            "href on <a> is not an allowed URL: \"sms:123\"",
        ),
        (
            "<img src=\"data:image/png;base64,AA\">",
            "src on <img> is not an allowed URL: \"data:image/png;base64,AA\"",
        ),
    ] {
        let root = fixture();
        write(
            root.path(),
            "specs/a.screen.html",
            &format!("---\ntitle: A\n---\n{body}"),
        );
        fails(
            root.path(),
            &format!(
                "[mokly/build-invalid] specs/a.screen.html:4:1: unsafe rendered document: {detail}\n"
            ),
        );
    }
}

#[test]
fn invalid_ignore_ids_and_unknown_wrapper_attributes_have_exact_diagnostics() {
    for (body, detail) in [
        (
            "<mokly-ignore id=\"Hero Banner!\">Text</mokly-ignore>",
            "invalid ignore id \"Hero Banner!\"; use lowercase kebab-case",
        ),
        (
            "<mokly-ignore id=\"hero\" class=\"x\">Text</mokly-ignore>",
            "unknown attribute class on <mokly-ignore>",
        ),
        (
            "<mokly-ignore-scope enabled=\"true\" class=\"x\">Text</mokly-ignore-scope>",
            "unknown attribute class on <mokly-ignore-scope>",
        ),
    ] {
        let root = fixture();
        write(
            root.path(),
            "specs/a.screen.html",
            &format!("---\ntitle: A\n---\n{body}"),
        );
        fails(
            root.path(),
            &format!(
                "[mokly/build-invalid] specs/a.screen.html:4:1: [mokly/html-element] {detail}\n"
            ),
        );
    }
}

#[test]
fn missing_required_component_props_keep_the_named_diagnostic() {
    let root = fixture();
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<ui-b></ui-b>",
    );
    write(
        root.path(),
        "specs/b.component.html",
        "---\ntitle: B\nelement: ui-b\npropSchema: {type: object, additionalProperties: false, properties: {label: {type: string}}, required: [label]}\nprops: {label: Saved}\n---\n<span>{{label}}</span>",
    );
    fails(
        root.path(),
        "[mokly/build-invalid] specs/a.screen.html:4:1: [mokly/html-attribute] b at \"/label\": \"label\" is a required property\n",
    );
}

#[test]
fn a_thousand_nested_elements_render_on_the_preparation_and_render_stacks() {
    let root = fixture();
    write(
        root.path(),
        "specs/deep.screen.html",
        &format!(
            "---\ntitle: Deep\n---\n{}Deep{}",
            "<div>".repeat(1000),
            "</div>".repeat(1000)
        ),
    );
    let output = run(root.path());
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert!(output.stdout.is_empty());
}

#[test]
fn postcss_runs_only_for_styles_and_reports_each_failure_once() {
    let root = fixture();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"postcss":"postcss.mjs"}"#,
    );
    write(
        root.path(),
        "postcss.mjs",
        "throw new Error('fixture-postcss-failure'); export default {};",
    );
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<p>A</p>",
    );
    let unused = run(root.path());
    assert_eq!(unused.status.code(), Some(0));
    assert!(unused.stdout.is_empty());
    assert!(unused.stderr.is_empty());
    write(
        root.path(),
        "mokly.config.json",
        r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
    );
    write(root.path(), "style.css", "p { color: red; }");
    let output = run(root.path());
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    let error = String::from_utf8(output.stderr).unwrap();
    assert!(error.starts_with("[mokly/build-invalid]"), "{error}");
    assert!(error.contains("postcss.mjs"), "{error}");
    assert_eq!(
        error.matches("fixture-postcss-failure").count(),
        1,
        "{error}"
    );
}
