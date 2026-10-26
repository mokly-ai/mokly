//! Edits to selected inputs during a build abort installation; other edits do not.

use std::fs;
use std::path::Path;

use mokly_test_support::files::{tree, write};
use mokly_test_support::process::Finished;
use mokly_test_support::publication;
use regex::Regex;
use serde_json::{Value, json};
use tempfile::TempDir;

use super::support::mokly;

fn render(root: &Path, mutation: &str) {
    write(
        root,
        "specs/home.mockup.ts",
        format!(
            "import fs from 'node:fs';\nimport {{definePage}} from '@mokly/mokly';\nimport {{message}} from '../helper.ts';\nexport default definePage({{title:'Home',description:'',relatedDocs:[],render(){{\n{mutation}\nreturn '<!doctype html><html><head><title>Home</title></head><body><h1>'+message+'</h1><img src=\"../../assets/logo.svg\"></body></html>';\n}}}});"
        ),
    );
}

fn fixture() -> TempDir {
    let root = publication::fixture(true, "sha1");
    let path = root.path();
    let inputs = [
        (
            "mokly.config.json",
            r#"{"renderer":"renderer.ts","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#,
        ),
        (
            "renderer.ts",
            "export default input => ({ node: input.node });\n",
        ),
        (
            "theme.css",
            "@import \"./more.css\"; body { color: black }\n",
        ),
        ("more.css", "h1 { font-weight: bold }\n"),
        (
            "helper.ts",
            "export const message = \"Stable catalogue\";\n",
        ),
        (
            "specs/extra.screen.html",
            "---\ntitle: Extra\n---\n<h1>Extra</h1><img src=\"../../assets/logo.svg\">\n",
        ),
        ("specs/_folder.json", "{}\n"),
        (
            "assets/logo.svg",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n",
        ),
        ("unrelated.txt", "outside the input set\n"),
        ("specs/unmatched.txt", "outside the discovery globs\n"),
    ];
    for (file, text) in inputs {
        write(path, file, text);
    }
    render(path, "");
    root
}

fn build(root: &Path) -> Finished {
    mokly()
        .command(
            root,
            &[
                "build",
                "--no-changes",
                "--sidecars=1",
                "--strict",
                "--out=.context/site",
            ],
            "plain",
        )
        .run()
}

fn read(root: &Path, file: &str) -> String {
    fs::read_to_string(root.join(file)).unwrap()
}

#[test]
fn edits_outside_the_selected_input_boundary_during_rendering_do_not_abort_a_build() {
    let root = fixture();
    let path = root.path();
    for file in ["unrelated.txt", "specs/unmatched.txt"] {
        render(
            path,
            &format!("fs.appendFileSync({}, 'changed');", json!(file)),
        );
        let result = build(path);
        assert_eq!(result.code, Some(0), "{}", result.stderr);
        assert!(read(path, file).contains("changed"));
        let output = tree(&path.join(".context/site"));
        assert!(output.iter().any(|(name, bytes)| {
            name.starts_with("static/mokly-generated/home/")
                && String::from_utf8_lossy(bytes).contains("Stable catalogue")
        }));
    }
}

#[test]
fn parent_globs_do_not_fingerprint_unrelated_files_in_explicitly_selected_child_roots() {
    let root = fixture();
    let path = root.path();
    fs::remove_file(path.join("specs/_folder.json")).unwrap();
    write(
        path,
        "catalog/guide.md",
        "---\ntitle: Guide\n---\n# Guide\n",
    );
    write(path, "catalog/target/unrelated.md", "unrelated\n");
    write(
        path,
        "catalog/target/home.screen.html",
        "---\ntitle: Target\n---\n<h1>Target</h1>\n",
    );
    let mut config: Value = serde_json::from_str(&read(path, "mokly.config.json")).unwrap();
    config["roots"] = json!([
        { "dir": "catalog", "files": ["**/*.md"] },
        { "dir": "catalog/target", "files": ["**/*.screen.html"], "path": "target" },
        { "dir": "specs", "files": ["**/*.mockup.ts"] },
    ]);
    write(path, "mokly.config.json", config.to_string());
    render(
        path,
        "fs.appendFileSync('catalog/target/unrelated.md', 'changed');",
    );
    let result = build(path);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert!(read(path, "catalog/target/unrelated.md").contains("changed"));
}

#[test]
fn each_selected_input_kind_aborts_changed_generation_installation_and_keeps_the_earlier_output() {
    for file in [
        "mokly.config.json",
        "renderer.ts",
        "theme.css",
        "more.css",
        "helper.ts",
        "specs/home.mockup.ts",
        "specs/extra.screen.html",
        "specs/_folder.json",
        "assets/logo.svg",
    ] {
        let root = fixture();
        let path = root.path();
        let first = build(path);
        assert_eq!(first.code, Some(0), "{}", first.stderr);
        let previous = tree(&path.join(".context/site"));
        render(path, &format!("fs.appendFileSync({}, '\\n');", json!(file)));
        let result = build(path);
        assert_eq!(result.code, Some(1), "{file}: {}", result.stderr);
        assert!(
            result
                .stderr
                .contains("[mokly/export-invalid] Inputs changed during the build:")
        );
        assert!(result.stderr.contains("Build again."));
        assert!(tree(&path.join(".context/site")) == previous, "{file}");
    }
}

#[test]
fn a_helper_edit_after_bundling_and_before_capture_preserves_the_earlier_output() {
    let root = fixture();
    let path = root.path();
    let mut config: Value = serde_json::from_str(&read(path, "mokly.config.json")).unwrap();
    config["postcss"] = json!("postcss.mjs");
    write(path, "mokly.config.json", config.to_string());
    write(
        path,
        "postcss.mjs",
        "import fs from 'node:fs';\nexport default {plugins:[{postcssPlugin:'edit-helper',Once(){\nif(fs.existsSync('.context/edit-helper')) {\nfs.writeFileSync('helper.ts', 'export const message = \"Edited catalogue\";\\n');\nfs.writeFileSync('.context/helper-edited', 'postcss ran');\n}\n}}]};",
    );
    let first = build(path);
    assert_eq!(first.code, Some(0), "{}", first.stderr);
    let previous = tree(&path.join(".context/site"));
    write(path, ".context/edit-helper", "edit");
    let result = build(path);
    assert_eq!(read(path, ".context/helper-edited"), "postcss ran");
    assert!(read(path, "helper.ts").contains("Edited catalogue"));
    assert_eq!(result.code, Some(1), "{}", result.stderr);
    let changed =
        Regex::new(r"\[mokly/export-invalid\] Inputs changed during the build:.*helper\.ts")
            .unwrap();
    assert!(changed.is_match(&result.stderr), "{}", result.stderr);
    assert!(result.stderr.contains("Build again."));
    assert!(tree(&path.join(".context/site")) == previous);
}

#[test]
fn matching_root_additions_and_removals_during_rendering_abort_installation() {
    for (file, mutation) in [
        (
            "new.screen.html",
            "fs.writeFileSync('specs/new.screen.html', '---\\ntitle: New\\n---\\n<h1>New</h1>');",
        ),
        (
            "extra.screen.html",
            "fs.rmSync('specs/extra.screen.html', {force:true});",
        ),
    ] {
        let root = fixture();
        let path = root.path();
        render(path, mutation);
        let result = build(path);
        assert_eq!(result.code, Some(1), "{}", result.stderr);
        assert!(
            result
                .stderr
                .contains("[mokly/export-invalid] Inputs changed during the build:")
        );
        assert!(result.stderr.contains(file));
        assert!(!path.join(".context/site").exists());
    }
}
