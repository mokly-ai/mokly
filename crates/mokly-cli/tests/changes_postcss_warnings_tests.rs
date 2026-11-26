//! PostCSS loads that require a Git-tracked file in a later comparison.

use std::fs;
use std::path::Path;

use tempfile::TempDir;

mod changes_support;
#[path = "changes_support/links.rs"]
mod links;

use changes_support::{base, run, run_configured, run_with_environment, write};
use links::link_directory;

const THEME_CONFIG: &str = r#"{"review":{"base":"fixture-base"},"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}],"moduleResolution":{"sourcePackages":{"fixture-theme":{"esm":"source"}}}}"#;
const DETECTED_CONFIG: &str = r#"{"review":{"base":"fixture-base"},"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#;
const PACKAGE_LOAD: &str = r#"const load = name => require(name); load("fixture-theme");"#;

#[test]
fn postcss_package_and_computed_relative_require_warn_for_the_same_file() {
    let root = postcss_fixture(THEME_CONFIG, "", &[]);
    write(
        root.path(),
        "packages/theme/esm/plugin.cjs",
        "module.exports = 'built';",
    );
    write(
        root.path(),
        "postcss.mjs",
        &postcss(&format!(
            r#"const file = "./packages/theme/esm/plugin.cjs"; require(file); {PACKAGE_LOAD}"#,
        )),
    );
    assert_strict_warning(root.path(), "packages/theme/esm/plugin.cjs");
}

#[test]
fn postcss_package_and_native_require_warn_for_the_same_file() {
    let root = postcss_fixture(THEME_CONFIG, "", &[]);
    write(
        root.path(),
        "packages/theme/esm/plugin.cjs",
        "module.exports = 'built';",
    );
    write(
        root.path(),
        "packages/theme/esm/data.json",
        r#""built JSON""#,
    );
    write(
        root.path(),
        "postcss.mjs",
        &postcss(&format!(
            r#"
import {{ createRequire }} from "node:module";
{PACKAGE_LOAD}
load("fixture-theme/data");
const native = createRequire(import.meta.url);
native("./packages/theme/esm/plugin.cjs");
"#,
        )),
    );
    assert_strict_warning(root.path(), "packages/theme/esm/plugin.cjs");
}

#[test]
fn postcss_computed_require_warns_for_an_ignored_link_to_a_tracked_file() {
    let root = postcss_fixture(
        DETECTED_CONFIG,
        "",
        &[("tracked/real.cjs", "module.exports = 'tracked';")],
    );
    let path = root.path();
    fs::create_dir(path.join("generated")).unwrap();
    let target = path.join("tracked/real.cjs");
    let link = path.join("generated/link.cjs");
    #[cfg(unix)]
    std::os::unix::fs::symlink(target, link).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_file(target, link).unwrap();
    write(
        path,
        "postcss.mjs",
        &postcss(r#"const file = "./generated/link.cjs"; require(file);"#),
    );
    assert_strict_warning(path, "generated/link.cjs");
}

#[test]
fn postcss_linked_package_build_has_no_warning_when_the_declared_target_can_recover() {
    let root = linked_build(THEME_CONFIG, "", &[]);
    write(root.path(), "postcss.mjs", &postcss(PACKAGE_LOAD));
    let output = run(root.path(), &["build", "--strict"]);
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, "");
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("Changes ready"), "{stdout}");
}

#[test]
fn postcss_linked_package_build_warns_when_only_the_link_target_has_a_layout() {
    let root = linked_build(
        DETECTED_CONFIG,
        PACKAGE_LOAD,
        &[(
            "packages/theme/tsconfig.json",
            r#"{"compilerOptions":{"outDir":"release","rootDir":"source"}}"#,
        )],
    );
    let output = run_configured(root.path(), &["build"], None, &[], "plain");
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    let expected = format!(
        "{}; set moduleResolution.sourcePackages for fixture-theme",
        warning("packages/theme/release/plugin.cjs")
    );
    assert!(stderr.lines().any(|line| line == expected), "{stderr}");
    assert!(
        stderr.contains("module packages/theme/esm/plugin.cjs has no source in this side"),
        "{stderr}"
    );
}

#[test]
fn postcss_ignores_the_node_options_preload_and_its_imports_for_warnings() {
    let root = postcss_fixture(
        DETECTED_CONFIG,
        r#"if (globalThis.preloadedValue !== "preloaded") throw new Error("expected preload");"#,
        &[],
    );
    let path = root.path();
    write(
        path,
        ".pnp.cjs",
        r#"globalThis.preloadedValue = require("./generated/preload-child.cjs");"#,
    );
    write(
        path,
        "generated/preload-child.cjs",
        "module.exports = 'preloaded';",
    );
    let options = format!(
        "--require={}",
        serde_json::to_string(&path.join(".pnp.cjs")).unwrap()
    );
    let output = run_with_environment(
        path,
        &["build", "--strict"],
        None,
        &[("NODE_OPTIONS", &options)],
    );
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(0), "{stderr}");
    assert_eq!(stderr, "");
}

fn linked_build(config: &str, loads: &str, extra: &[(&str, &str)]) -> TempDir {
    let root = postcss_fixture(config, loads, extra);
    let path = root.path();
    write(
        path,
        "packages/theme/release/plugin.cjs",
        "module.exports = 'built';",
    );
    link_directory(
        &path.join("packages/theme/release"),
        &path.join("packages/theme/esm"),
    );
    root
}

fn postcss_fixture(config: &str, loads: &str, extra: &[(&str, &str)]) -> TempDir {
    let module = postcss(loads);
    let mut files = vec![
        (
            ".gitignore",
            "node_modules/\nmokly-static/\ngenerated/\n.pnp.cjs\npackages/theme/esm/\npackages/theme/release/\n",
        ),
        (
            "package.json",
            r#"{"name":"catalogue","private":true,"workspaces":["packages/*"]}"#,
        ),
        ("mokly.config.json", config),
        ("postcss.mjs", &module),
        ("style.css", "p { color: red; }"),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
        (
            "packages/theme/package.json",
            r#"{"name":"fixture-theme","exports":{".":"./esm/plugin.cjs","./data":"./esm/data.json"}}"#,
        ),
        (
            "packages/theme/source/plugin.js",
            "module.exports = 'source';",
        ),
        ("packages/theme/source/data.json", r#""source JSON""#),
    ];
    files.extend_from_slice(extra);
    let root = base(&files);
    let modules = root.path().join("node_modules");
    fs::create_dir(&modules).unwrap();
    link_directory(
        &root.path().join("packages/theme"),
        &modules.join("fixture-theme"),
    );
    root
}

fn postcss(loads: &str) -> String {
    format!("{loads}\nexport default {{ plugins: [] }};")
}

fn warning(file: &str) -> String {
    format!(
        "[mokly/warning] configuration \"mokly.config.json\": module {file} is ignored by Git, so a later base cannot load it"
    )
}

fn assert_strict_warning(path: &Path, file: &str) {
    let output = run_configured(path, &["build", "--strict"], None, &[], "plain");
    let stderr = String::from_utf8(output.stderr).unwrap();
    assert_eq!(output.status.code(), Some(1), "{stderr}");
    assert_eq!(
        stderr,
        format!(
            "{}\n[mokly/build-invalid] 1 build warning with --strict\n",
            warning(file)
        )
    );
}
