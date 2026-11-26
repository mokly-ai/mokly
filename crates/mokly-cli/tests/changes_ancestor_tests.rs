//! Historical aliases and bare imports find ignored configuration ancestor packages.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_model::namespace;
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;

mod changes_support;
use changes_support::{base, run, run_configured, write};

#[test]
fn nested_configuration_aliases_and_bare_imports_use_working_dependencies_on_both_sides() {
    let config = r#"{"repoRoot":"..","roots":[{"dir":"specs"}],"review":{"base":"fixture-base"},"moduleResolution":{"aliases":{"theme-alias":"base-theme"}},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#;
    let root = base(&[
        ("app/mokly.config.json", config),
        (
            "app/style.css",
            "@import 'theme-alias/skin.css'; @import 'plain-theme/skin.css';",
        ),
        (
            "app/specs/card.mockup.tsx",
            "import {defineComponent} from '@mokly/mokly'; import {label} from 'theme-alias'; import {label as plain} from 'plain-theme'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],props:{},element:'ui-card',propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <p>{label}:{plain}</p>});",
        ),
    ]);
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    link_directory(&modules, &root.path().join("node_modules"));
    for (name, label) in [
        ("base-theme", "Before"),
        ("head-theme", "After"),
        ("plain-theme", "Plain"),
    ] {
        package(root.path(), name, label);
    }
    write(
        root.path(),
        "app/mokly.config.json",
        &config.replace("base-theme", "head-theme"),
    );
    let output = run(root.path(), &["build", "--config", "app/mokly.config.json"]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");
    assert!(
        output.stderr.is_empty(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn changes_render_workspace_sources_when_only_the_head_has_a_build() {
    let root = base(&[
        (
            ".gitignore",
            "node_modules/\nmokly-static/\npackages/theme/dist/\n",
        ),
        (
            "package.json",
            r#"{"name":"catalogue","private":true,"workspaces":["packages/*"]}"#,
        ),
        (
            "app/mokly.config.json",
            r#"{"repoRoot":"..","roots":[{"dir":"specs"}],"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
        ),
        ("app/style.css", "@import 'workspace-theme/skin.css';"),
        (
            "app/specs/card.mockup.tsx",
            "import {defineComponent} from '@mokly/mokly'; import {label} from 'workspace-theme'; export const card=defineComponent({title:'Card',description:'',relatedDocs:[],props:{},element:'ui-card',propSchema:{type:'object',additionalProperties:false,properties:{}},render:()=> <p>{label}</p>});",
        ),
        (
            "packages/theme/package.json",
            r#"{"name":"workspace-theme","exports":{".":"./dist/index.js","./skin.css":"./dist/skin.css"}}"#,
        ),
        (
            "packages/theme/src/index.ts",
            "export const label = 'Before';",
        ),
        ("packages/theme/src/skin.css", "p { color: blue; }"),
    ]);
    let path = root.path();
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    link_directory(&modules, &path.join("node_modules"));
    fs::create_dir_all(path.join("app/node_modules")).unwrap();
    link_directory(
        &path.join("packages/theme"),
        &path.join("app/node_modules/workspace-theme"),
    );
    write(
        path,
        "packages/theme/dist/index.js",
        "export const label = 'Built';",
    );
    write(path, "packages/theme/dist/skin.css", "p { color: red; }");
    write(
        path,
        "packages/theme/src/index.ts",
        "export const label = 'After';",
    );
    let output = run(
        path,
        &["build", "--config", "app/mokly.config.json", "--strict"],
    );
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    assert!(stderr.is_empty(), "{stderr}");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Changes ready · 1 change"), "{stdout}");

    let published = path.join("mokly-static");
    let index: CatalogueReadModel =
        serde_json::from_slice(&fs::read(published.join(namespace::viewer("index.json"))).unwrap())
            .unwrap();
    assert_eq!(index.changes_status, ChangesStatus::Ready);
    let comparison = published.join(index.comparison_url.0.unwrap());
    assert!(comparison.is_dir(), "{}", comparison.display());
}

const WARNINGS: &str = concat!(
    "[mokly/warning] configuration \"mokly.config.json\": module generated/bundled.mjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/loose.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/index.mjs is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/skin.css is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
);

#[test]
fn build_warns_only_for_ignored_imports_and_strict_preserves_the_output() {
    let root = base(&[
        (
            ".gitignore",
            "node_modules/\nmokly-static/\ngenerated/\npackages/theme/esm/\n",
        ),
        (
            "packages/theme/package.json",
            r#"{"name":"workspace-theme"}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
    ]);
    let path = root.path();
    let modules = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../node_modules");
    link_directory(&modules, &path.join("node_modules"));
    write(
        path,
        "mokly.config.json",
        r#"{"review":{"base":"fixture-base"},"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
    );
    write(
        path,
        "postcss.mjs",
        "import {value} from './generated/bundled.mjs'; const plugin = './generated/plugin.cjs'; export default {plugins:[require(plugin)(value)]};",
    );
    write(
        path,
        "generated/plugin.cjs",
        "module.exports = value => ({postcssPlugin:'fixture', Declaration(decl) { if (decl.prop === '--fixture') decl.value = value; }});",
    );
    write(
        path,
        "generated/bundled.mjs",
        "export const value = 'node-loaded';",
    );
    write(
        path,
        "style.css",
        "@import './packages/theme/esm/skin.css'; @import './generated/loose.css'; @import './untracked.css'; p { --fixture: before }",
    );
    write(path, "generated/loose.css", ".loose { color: blue }");
    write(path, "untracked.css", ".untracked { color: green }");
    write(path, "packages/theme/esm/skin.css", ".theme { color: red }");
    write(
        path,
        "packages/theme/esm/index.mjs",
        "export const label = 'Built';",
    );
    write(
        path,
        "specs/page.mockup.ts",
        "import {definePage} from '@mokly/mokly'; import {label} from '../packages/theme/esm/index.mjs'; import '../packages/theme/esm/skin.css'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>`<!doctype html><html><head><title>Page</title></head><body>${label}</body></html>`});",
    );

    let run = |args: &[&str]| run_configured(path, args, None, None, "plain");
    let build = run(&["build"]);
    let stderr = String::from_utf8(build.stderr).unwrap();
    assert_eq!(build.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, WARNINGS);
    let output = path.join("mokly-static");
    let css = fs::read_to_string(output.join(namespace::generated("styles/style.css"))).unwrap();
    for text in [".loose", ".untracked", ".theme", "node-loaded"] {
        assert!(css.contains(text), "{css}");
    }

    let index = output.join(namespace::viewer("index.json"));
    let written = fs::read(&index).unwrap();
    let strict = run(&["build", "--strict"]);
    assert_eq!(strict.status.code(), Some(1));
    assert_eq!(
        String::from_utf8(strict.stderr).unwrap(),
        format!("{WARNINGS}[mokly/build-invalid] 4 build warnings with --strict\n")
    );
    assert_eq!(fs::read(index).unwrap(), written);

    let disabled = run(&["build", "--strict", "--no-changes"]);
    let stderr = String::from_utf8(disabled.stderr).unwrap();
    assert_eq!(disabled.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, "");
}

fn link_directory(target: &Path, link: &Path) {
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(target, link).unwrap();
}

fn package(root: &Path, name: &str, label: &str) {
    write(
        root,
        &format!("app/node_modules/{name}/package.json"),
        &format!(r#"{{"name":"{name}","main":"index.mjs"}}"#),
    );
    write(
        root,
        &format!("app/node_modules/{name}/index.mjs"),
        &format!("export const label='{label}';"),
    );
    write(
        root,
        &format!("app/node_modules/{name}/skin.css"),
        &format!(".{label} {{color:red}}"),
    );
}
