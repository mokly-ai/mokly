//! Mixed catalogues compare historical JavaScript and PostCSS through the shared runtime.

use std::fs;
use std::path::{Path, PathBuf};

mod changes_support;
use changes_support::{base, run, run_with_node, write};

const CARD: &str = "import {defineComponent} from '@mokly/mokly'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],props:{},element:'ui-card',propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <p className='card'>Before</p>});";
const HOME: &str = "---\ntitle: Home\n---\n<h1 class=\"html-title\">Before</h1><ui-card></ui-card>";
const CONFIG: &str = r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#;

fn dependencies(root: &Path) {
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.join("node_modules")).unwrap();
}

#[test]
fn mixed_html_react_and_stylesheet_changes_compare_with_the_git_base() {
    for change in ["html", "react", "css", "all"] {
        let root = base(&[
            ("mokly.config.json", CONFIG),
            ("specs/card.mockup.tsx", CARD),
            ("specs/home.screen.html", HOME),
            ("style.css", ".html-title{color:red}"),
        ]);
        dependencies(root.path());
        if change == "html" || change == "all" {
            write(
                root.path(),
                "specs/home.screen.html",
                &HOME.replace("Before", "After"),
            );
        }
        if change == "react" || change == "all" {
            write(
                root.path(),
                "specs/card.mockup.tsx",
                &CARD.replace("Before", "After"),
            );
        }
        if change == "css" || change == "all" {
            write(root.path(), "style.css", ".html-title{color:blue}");
        }
        let output = run(root.path(), &["build"]);
        assert_eq!(
            output.status.code(),
            Some(0),
            "{change}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let stdout = String::from_utf8_lossy(&output.stdout);
        assert!(
            stdout.contains(if change == "all" {
                "Changes ready · 2 changes"
            } else {
                "Changes ready · 1 change"
            }),
            "{change}: {stdout}"
        );
        assert_eq!(stdout.matches("  cache ").count(), 1);
        assert!(
            output.stderr.is_empty(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

#[test]
fn historical_postcss_relative_reads_change_only_the_owned_component() {
    let root = base(&[
        (
            "mokly.config.json",
            &CONFIG.replace("\"review\"", "\"postcss\":\"postcss.mjs\",\"review\""),
        ),
        ("specs/card.mockup.tsx", CARD),
        ("specs/home.screen.html", HOME),
        ("style.css", ".card{color:red}"),
        ("tone.txt", "red"),
        (
            "postcss.mjs",
            "import fs from 'node:fs'; import path from 'node:path'; export default {plugins:[{postcssPlugin:'tone',Once(root,{result}){const file=path.resolve('tone.txt');root.walkDecls('color',d=>d.value=fs.readFileSync(file,'utf8'));result.messages.push({type:'dependency',file,plugin:'tone'});}}]};",
        ),
    ]);
    dependencies(root.path());
    write(root.path(), "tone.txt", "blue");
    let output = run(root.path(), &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("Changes ready · 1 change"));
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn historical_javascript_validation_keeps_typed_diagnostics_and_current_build() {
    let invalid = CARD.replace("export const card", "const card") + "export const broken = [card];";
    let root = base(&[("specs/card.mockup.tsx", &invalid)]);
    dependencies(root.path());
    fs::write(root.path().join("specs/card.mockup.tsx"), CARD).unwrap();
    let output = run(root.path(), &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout)
            .contains("Changes unavailable · base validation failed")
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("[mokly/array-export]") && stderr.contains("specs/card.mockup.tsx"),
        "{stderr}"
    );
    assert!(
        !stderr.contains("[mokly-catalogue/") && !stderr.contains("[mokly-compare/"),
        "{stderr}"
    );
}

#[test]
fn a_missing_node_for_base_only_javascript_makes_changes_unavailable() {
    let root = base(&[
        ("specs/card.mockup.tsx", CARD),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
    ]);
    fs::remove_file(root.path().join("specs/card.mockup.tsx")).unwrap();
    let output = run_with_node(
        root.path(),
        &["build"],
        Some(&root.path().join("missing-node")),
    );
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout)
            .contains("Changes unavailable · base runtime unavailable")
    );
    assert!(String::from_utf8_lossy(&output.stderr).contains("[mokly/build-invalid]"));
}

#[test]
fn a_base_with_only_a_configured_renderer_uses_extracted_sources() {
    let root = base(&[
        (
            "mokly.config.json",
            r#"{"renderer":"renderer.mjs","review":{"base":"fixture-base"}}"#,
        ),
        ("renderer.mjs", "export default ({children}) => children;"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Before</p>",
        ),
    ]);
    dependencies(root.path());
    fs::remove_file(root.path().join("renderer.mjs")).unwrap();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"}}"#,
    );
    write(
        root.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>After</p>",
    );
    let output = run(root.path(), &["build"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");
    assert_eq!(stdout.matches("  cache ").count(), 1);
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn a_hanging_base_render_keeps_the_current_static_build_available() {
    let root = base(&[
        (
            "specs/card.mockup.tsx",
            &CARD.replace(
                "render:()=> <p className='card'>Before</p>",
                "render:()=> {while(true) {}}",
            ),
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Current</p>",
        ),
    ]);
    dependencies(root.path());
    fs::remove_file(root.path().join("specs/card.mockup.tsx")).unwrap();
    let output = changes_support::run_with_timeout(root.path(), &["build"], None, Some("10000"));
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        String::from_utf8_lossy(&output.stdout)
            .contains("Changes unavailable · base runtime timed out"),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("specs/card.mockup.tsx export card") && stderr.contains("exceeded 10000ms"),
        "{stderr}"
    );
    assert!(root.path().join("mokly-static/index.html").is_file());
}

#[test]
fn a_renderer_named_through_a_parent_segment_compares_its_stylesheet() {
    let root = base(&[
        (
            "app/mokly.config.json",
            r#"{"repoRoot":"..","roots":[{"dir":"../specs"}],"renderer":"../renderer.tsx","review":{"base":"fixture-base"}}"#,
        ),
        ("specs/card.mockup.tsx", CARD),
        (
            "renderer.tsx",
            "import type { RenderInput } from '@mokly/mokly'; import './renderer.css'; export default function render(input: RenderInput) { return input.node; }",
        ),
        ("renderer.css", ".card{color:red}"),
    ]);
    dependencies(root.path());
    write(root.path(), "renderer.css", ".card{color:blue}");
    let output = run(root.path(), &["build", "--config", "app/mokly.config.json"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");
}
