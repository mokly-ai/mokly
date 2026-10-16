//! Historical aliases and bare imports find ignored configuration ancestor packages.

use std::path::{Path, PathBuf};

mod changes_support;
use changes_support::{base, run, write};

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
    #[cfg(unix)]
    std::os::unix::fs::symlink(modules, root.path().join("node_modules")).unwrap();
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(modules, root.path().join("node_modules")).unwrap();
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
