//! The native CLI compares workspace packages with custom build and source layouts.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::review_affected::ReviewSide;
use mokly_model::{namespace, routes};
use serde_json::{Value, json};
use tempfile::TempDir;

mod changes_support;
#[path = "changes_support/links.rs"]
mod links;
use changes_support::{base, run, run_configured, write};
use links::link_directory;

const CONFIG_PATH: &str = "app/mokly.config.json";
const STYLESHEET_PATH: &str = "app/style.css";

#[test]
fn changes_use_source_when_both_configurations_have_the_same_override() {
    let root = workspace(Some("source"));
    assert_changes_use_source(root.path());
}

#[test]
fn identical_source_overrides_reuse_head_stylesheets_and_renders() {
    let root = workspace_fixture(Some("source"), "@import '@acme/ui/skin.css';");
    let output = run(
        root.path(),
        &["build", "--config", CONFIG_PATH, "--debug-timings"],
    );
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    let index = read_index(&root.path().join("mokly-static"));
    assert_eq!(index.changes_status, ChangesStatus::Ready, "{stderr}");

    let timings: Vec<Value> = stderr
        .lines()
        .filter_map(|line| line.strip_prefix("[mokly:timing] "))
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    let starts = |stage: &str| {
        timings
            .iter()
            .filter(|record| record["stage"] == stage && record["event"] == "start")
            .count()
    };
    let base_capture = timings
        .iter()
        .find(|record| {
            record["stage"] == "review.capture-side"
                && record["side"] == "base"
                && record["event"] == "counts"
        })
        .expect("the base captures its views");
    let cache = timings
        .iter()
        .find(|record| {
            record["stage"] == "render.cache" && record["parentId"] == base_capture["id"]
        })
        .expect("the base capture reports render cache counts");
    assert_eq!(starts("css.bundle"), 1, "only the head compiles CSS");
    assert_eq!(starts("render.fragment"), 2, "only the head renders JS");
    assert_eq!(base_capture["views"], json!(2));
    assert_eq!(cache["misses"], json!(0));
}

#[test]
fn changes_use_the_working_override_when_the_base_has_no_entry() {
    let root = workspace(None);
    write(root.path(), CONFIG_PATH, &config(Some("source")));
    assert_changes_use_source(root.path());
}

#[test]
fn changes_use_each_sides_override_after_a_source_folder_rename() {
    let root = workspace(Some("source"));
    let package = root.path().join("packages/ui");
    fs::rename(package.join("source"), package.join("src2")).unwrap();
    write(root.path(), CONFIG_PATH, &config(Some("src2")));
    assert_changes_use_source(root.path());
}

#[test]
fn changes_fall_back_to_the_working_override_when_the_base_entry_misses() {
    let root = workspace(Some("wrong"));
    write(root.path(), CONFIG_PATH, &config(Some("source")));
    assert_changes_use_source(root.path());
}

#[test]
fn changes_explain_the_missing_override_when_only_the_head_can_load_the_build() {
    let root = workspace_with_stylesheet(None, ".workspace-card { color: blue; }");
    let output = run_configured(
        root.path(),
        &["build", "--config", CONFIG_PATH],
        None,
        None,
        "plain",
    );
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    let index = read_index(&root.path().join("mokly-static"));
    assert_eq!(index.changes_status, ChangesStatus::Unavailable, "{stderr}");
    assert_eq!(index.comparison_url.0, None);

    let base_diagnostic = stderr
        .lines()
        .skip_while(|line| !line.starts_with("base "))
        .collect::<Vec<_>>()
        .join("\n");
    assert!(
        base_diagnostic.contains("module packages/ui/esm/index.js has no source in this side; set moduleResolution.sourcePackages for @acme/ui"),
        "{stderr}"
    );
    let warning = concat!(
        "[mokly/warning] configuration \"app/mokly.config.json\": ",
        "module packages/ui/esm/index.js is ignored by Git, so a later base cannot load it; ",
        "set moduleResolution.sourcePackages for @acme/ui",
    );
    assert!(stderr.lines().any(|line| line == warning), "{stderr}");
}

fn workspace(base_source: Option<&str>) -> TempDir {
    workspace_with_stylesheet(base_source, "@import '@acme/ui/skin.css';")
}

fn workspace_fixture(base_source: Option<&str>, stylesheet: &str) -> TempDir {
    let root = base(&[
        (
            ".gitignore",
            "node_modules/\nmokly-static/\npackages/ui/esm/\n",
        ),
        (
            "package.json",
            r#"{"name":"catalogue","private":true,"workspaces":["packages/*"]}"#,
        ),
        (CONFIG_PATH, &config(base_source)),
        (STYLESHEET_PATH, stylesheet),
        (
            "app/specs/card.mockup.tsx",
            "import {defineComponent} from '@mokly/mokly'; import {label} from '@acme/ui'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],props:{},element:'ui-card',propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <p className='workspace-card'>{label}</p>});",
        ),
        (
            "packages/ui/package.json",
            r#"{"name":"@acme/ui","exports":{".":"./esm/index.js","./skin.css":"./esm/skin.css"}}"#,
        ),
        (
            "packages/ui/source/index.ts",
            "export const label = 'Base source';",
        ),
        (
            "packages/ui/source/skin.css",
            ".workspace-card { --workspace-tone: base-source; }",
        ),
    ]);
    let path = root.path();
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    link_directory(&modules, &path.join("node_modules"));
    fs::create_dir_all(path.join("app/node_modules/@acme")).unwrap();
    link_directory(
        &path.join("packages/ui"),
        &path.join("app/node_modules/@acme/ui"),
    );
    root
}

fn workspace_with_stylesheet(base_source: Option<&str>, stylesheet: &str) -> TempDir {
    let root = workspace_fixture(base_source, stylesheet);
    let path = root.path();
    write(
        path,
        "packages/ui/esm/index.js",
        "export const label = 'Build output';",
    );
    write(
        path,
        "packages/ui/esm/skin.css",
        ".workspace-card { --workspace-tone: build-output; }",
    );
    write(
        path,
        "packages/ui/source/index.ts",
        "export const label = 'Working source';",
    );
    write(
        path,
        "packages/ui/source/skin.css",
        ".workspace-card { --workspace-tone: working-source; }",
    );
    root
}

fn config(source: Option<&str>) -> String {
    let mut config = json!({
        "repoRoot": "..",
        "roots": [{"dir": "specs"}],
        "review": {"base": "fixture-base"},
        "stylesheets": [{"match": "**", "stylesheets": ["style.css"]}]
    });
    if let Some(source) = source {
        config["moduleResolution"] = json!({"sourcePackages": {"@acme/ui": {"esm": source}}});
    }
    config.to_string()
}

fn assert_changes_use_source(root: &Path) {
    let output = run(root, &["build", "--config", CONFIG_PATH]);
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(
        stdout.contains("Changes ready · 1 change"),
        "{stdout}\n{stderr}"
    );
    assert!(stderr.is_empty(), "{stderr}");

    let published = root.join("mokly-static");
    let index = read_index(&published);
    assert_eq!(index.changes_status, ChangesStatus::Ready);
    let comparison = published.join(index.comparison_url.0.unwrap());
    let card = routes::view("card", Viewport::Desktop, ColorScheme::Light);
    let generated = namespace::GENERATED_DIRECTORY;
    for (side, markup, tone) in [
        (ReviewSide::Before, ">Base source</p>", "base-source"),
        (ReviewSide::After, ">Working source</p>", "working-source"),
    ] {
        let card = routes::comparison_snapshot(side, &format!("{generated}/{card}"));
        let html = fs::read_to_string(comparison.join(card)).unwrap();
        assert!(html.contains(markup), "{side:?}: {html}");

        let style =
            routes::comparison_snapshot(side, &format!("{generated}/styles/{STYLESHEET_PATH}"));
        let css = fs::read_to_string(comparison.join(style)).unwrap();
        assert!(css.contains(tone), "{side:?}: {css}");
    }
}

fn read_index(published: &Path) -> CatalogueReadModel {
    serde_json::from_slice(&fs::read(published.join(namespace::viewer("index.json"))).unwrap())
        .unwrap()
}
