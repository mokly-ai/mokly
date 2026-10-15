//! Review regressions assert complete public diagnostics through the native CLI.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use tempfile::TempDir;

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}
fn write(root: &Path, path: &str, text: &str) {
    let file = root.join(path);
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(file, text).unwrap();
}
fn fixture() -> TempDir {
    let directory = tempfile::tempdir().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    #[cfg(unix)]
    std::os::unix::fs::symlink(
        workspace().join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(
        workspace().join("node_modules"),
        directory.path().join("node_modules"),
    )
    .unwrap();
    directory
}
fn command(root: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command
        .args(["build", "--strict", "--no-changes", "--sidecars", "1"])
        .current_dir(root)
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_PACKAGE_ROOT", workspace().join("packages/mokly"))
        .env_remove("MOKLY_NODE_EXECUTABLE")
        .env_remove("MOKLY_SIDECAR_TIMEOUT_MS");
    command
}
fn failure(output: Output, expected: &str) {
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
fn invalid_postcss_configuration_never_starts_node() {
    let root = fixture();
    write(
        root.path(),
        "specs/a.screen.html",
        "---\ntitle: A\n---\n<p>A</p>",
    );
    write(root.path(), "style.css", "p { color: red }");
    write(root.path(), "postcss.json", "{}");
    for (value, expected) in [
        (
            serde_json::json!("postcss.json"),
            "postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: postcss.json",
        ),
        (
            serde_json::json!("missing.mjs"),
            "postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: missing.mjs",
        ),
        (
            serde_json::json!("../outside.mjs"),
            "postcss must name a config-relative module inside repoRoot: ../outside.mjs; choose an existing .ts, .mts, .js, .mjs or .cjs file",
        ),
        (
            serde_json::json!(false),
            "postcss must name a config-relative module inside repoRoot: false; choose an existing .ts, .mts, .js, .mjs or .cjs file",
        ),
    ] {
        write(root.path(), "mokly.config.json", &serde_json::json!({"postcss":value,"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}).to_string());
        let output = command(root.path()).env("PATH", "").output().unwrap();
        failure(output, &format!("[mokly/config-invalid] {expected}\n"));
    }
}

#[test]
fn a_configured_renderer_requires_a_function_default_export() {
    let root = fixture();
    write(
        root.path(),
        "mokly.config.json",
        r#"{"renderer":"renderer.mjs"}"#,
    );
    write(
        root.path(),
        "specs/item.mockup.ts",
        "import {defineScreen} from '@mokly/mokly'; export default defineScreen({title:'A',description:'',relatedDocs:[],props:{},render:()=>null});",
    );
    for module in [
        "export const named = () => null;",
        "export default undefined;",
        "export default 42;",
    ] {
        write(root.path(), "renderer.mjs", module);
        failure(
            command(root.path()).output().unwrap(),
            "[mokly/build-invalid] specs/item.mockup.ts export default (desktop, light): renderer default export must be a function\n[mokly/build-invalid] specs/item.mockup.ts export default (mobile, light): renderer default export must be a function\n",
        );
    }
}

#[test]
fn native_and_sidecar_component_props_errors_put_location_before_code() {
    let root = fixture();
    let schema = "propSchema:{type:'object',additionalProperties:false,properties:{label:{type:'string'}},required:['label']}";
    for (props, expected) in [
        ("42", "props must be an object"),
        ("{label:()=>null}", "/label: value is not plain data"),
        ("{}", "at \"/label\": \"label\" is a required property"),
    ] {
        write(
            root.path(),
            "specs/item.mockup.ts",
            &format!(
                "import {{defineComponent}} from '@mokly/mokly'; export default defineComponent({{title:'A',description:'',relatedDocs:[],{schema},props:{props},render:()=>null}});"
            ),
        );
        failure(
            command(root.path()).output().unwrap(),
            &format!(
                "[mokly/build-invalid] specs/item.mockup.ts export default: [mokly/component-props] {expected}\n"
            ),
        );
    }
}

#[test]
fn hashes_in_module_names_stay_intact_in_screen_and_page_failures() {
    let root = fixture();
    write(
        root.path(),
        "specs/item#tag.mockup.ts",
        "import {defineScreen} from '@mokly/mokly'; export default defineScreen({path:'item',title:'A',description:'',relatedDocs:[],props:{},render(){throw new Error('render exploded')}});",
    );
    failure(
        command(root.path()).output().unwrap(),
        "[mokly/build-invalid] specs/item#tag.mockup.ts export default (desktop, light): render exploded\n[mokly/build-invalid] specs/item#tag.mockup.ts export default (mobile, light): render exploded\n",
    );
    write(
        root.path(),
        "specs/item#tag.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({path:'item',title:'A',description:'',relatedDocs:[],render(){throw new Error('page exploded')}});",
    );
    failure(
        command(root.path()).output().unwrap(),
        "[mokly/build-invalid] specs/item#tag.mockup.ts export default: page exploded\n",
    );
}

#[test]
fn bundle_syntax_errors_keep_the_source_and_reason_without_tool_framing() {
    let root = fixture();
    write(
        root.path(),
        "specs/item.mockup.ts",
        "export const broken = ;\n",
    );
    failure(
        command(root.path()).output().unwrap(),
        "[mokly/build-invalid] specs/item.mockup.ts:1:23: Unexpected \";\"\n",
    );
}
