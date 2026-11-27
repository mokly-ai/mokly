//! Historical aliases and bare imports find ignored configuration ancestor packages.

use std::fs;
use std::path::{Path, PathBuf};

use mokly_model::axes::{ColorScheme, Viewport};
use mokly_model::public_index::CatalogueReadModel;
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::{namespace, routes};

mod changes_support;
#[path = "changes_support/ignored_modules.rs"]
mod ignored_modules;
#[path = "changes_support/links.rs"]
mod links;
use changes_support::{base, run, run_configured, write};
use ignored_modules::{LOGO, warning_fixture};
use links::link_directory;

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
    "[mokly/warning] configuration \"mokly.config.json\": module generated/computed.mjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/loose.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/native.cjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/native.json is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/plugin.cjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/tailwind/direct.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/tailwind/nested.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module generated/tailwind/reference.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/disabled/dist/index.cjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/plugin-theme/dist/skin.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/record/esm/index.mjs is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for record-plugin\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/ignored-source.cjs is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/index.mjs is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/logo.svg is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/package.css is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/package.mjs is ignored by Git, so a later base cannot load it; set moduleResolution.sourcePackages for workspace-theme\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/esm/skin.css is ignored by Git, so a later base cannot load it\n",
    "[mokly/warning] configuration \"mokly.config.json\": module packages/theme/root.cjs is ignored by Git, so a later base cannot load it\n",
);

#[test]
fn build_warns_only_for_ignored_imports_and_strict_preserves_the_output() {
    let root = warning_fixture();
    let path = root.path();
    let run = |args: &[&str]| run_configured(path, args, None, &[], "plain");
    let build = run(&["build"]);
    let stderr = String::from_utf8(build.stderr).unwrap();
    assert_eq!(build.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, WARNINGS);
    let output = path.join("mokly-static");
    let asset = output.join(namespace::generated("assets/packages/theme/esm/logo.svg"));
    assert_eq!(fs::read_to_string(asset).unwrap(), LOGO);
    let css = fs::read_to_string(output.join(namespace::generated("styles/style.css"))).unwrap();
    for text in [".loose", ".untracked", ".theme", ".package", "node-loaded"] {
        assert!(css.contains(text), "{css}");
    }
    let css = fs::read_to_string(output.join(namespace::generated("styles/tailwind.css"))).unwrap();
    for text in [".direct", ".nested", ".plugin-theme"] {
        assert!(css.contains(text), "{css}");
    }

    let index = output.join(namespace::viewer("index.json"));
    let written = fs::read(&index).unwrap();
    let installed: CatalogueReadModel = serde_json::from_slice(&written).unwrap();
    let home = output.join(namespace::generated(&routes::view(
        "home",
        Viewport::Desktop,
        ColorScheme::Light,
    )));
    let rendered_home = fs::read_to_string(&home).unwrap();
    assert!(rendered_home.contains("<p>Home</p>"), "{rendered_home}");
    write(
        path,
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<p>Changed Home</p>",
    );
    let strict = run(&["build", "--strict"]);
    assert_eq!(strict.status.code(), Some(1));
    assert_eq!(
        String::from_utf8(strict.stderr).unwrap(),
        format!("{WARNINGS}[mokly/build-invalid] 19 build warnings with --strict\n")
    );
    let after = fs::read(&index).unwrap();
    let after_strict: CatalogueReadModel = serde_json::from_slice(&after).unwrap();
    assert_eq!(after_strict.deployment_id, installed.deployment_id);
    assert_eq!(after, written);
    assert_eq!(fs::read_to_string(&home).unwrap(), rendered_home);

    let disabled = run(&["build", "--strict", "--no-changes"]);
    let stderr = String::from_utf8(disabled.stderr).unwrap();
    assert_eq!(disabled.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, "");
    let rebuilt = fs::read_to_string(home).unwrap();
    assert!(rebuilt.contains("<p>Changed Home</p>"), "{rebuilt}");
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
