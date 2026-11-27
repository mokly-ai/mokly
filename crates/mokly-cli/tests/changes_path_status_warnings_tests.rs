//! A catalogue loads files with each Git path status and reports the unavailable ones.

use std::fs;
use std::path::Path;

use mokly_model::namespace;

#[expect(
    dead_code,
    reason = "the warning assertion uses the plain output helper"
)]
mod changes_support;
#[path = "changes_support/links.rs"]
mod links;

use changes_support::{base, git, run_configured, write};
use links::link_directory;

#[test]
fn build_warns_for_ignored_files_nested_checkouts_and_submodules() {
    let root = base(&[
        (
            ".gitignore",
            "node_modules/\nmokly-static/\n.context/\n/generated/\n/replaced/skin.css\n",
        ),
        (
            "mokly.config.json",
            r#"{"review":{"base":"fixture-base"},"stylesheets":[{"match":"**","stylesheets":["style.css"]}]}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<p>Home</p>",
        ),
        ("style.css", "@import './tracked.css';"),
        ("tracked.css", ".fixture-tracked { color: red }"),
        ("replaced", "tracked file"),
    ]);
    let source = base(&[
        (
            "package.json",
            r#"{"name":"fixture-theme","exports":{"./nested.css":"./esm/nested.css","./submodule.css":"./esm/submodule.css"}}"#,
        ),
        ("esm/nested.css", ".fixture-nested { color: red }"),
        ("esm/submodule.css", ".fixture-submodule { color: red }"),
    ]);
    let path = root.path();
    let source = source.path().to_str().unwrap();
    git(path, &["clone", "--", source, "vendor/nested"]);
    git(
        path,
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            source,
            "vendor/submodule",
        ],
    );
    link_package(path, "nested");
    link_package(path, "submodule");
    fs::remove_file(path.join("replaced")).unwrap();
    write(
        path,
        "replaced/skin.css",
        ".fixture-replaced { color: red }",
    );
    write(
        path,
        "generated/skin.css",
        ".fixture-ignored { color: red }",
    );
    write(path, "fresh.css", ".fixture-untracked { color: red }");
    write(
        path,
        "style.css",
        concat!(
            "@import './tracked.css';\n",
            "@import './fresh.css';\n",
            "@import './generated/skin.css';\n",
            "@import './replaced/skin.css';\n",
            "@import 'nested/nested.css';\n",
            "@import 'submodule/submodule.css';\n",
        ),
    );

    let build = run_configured(path, &["build"], None, &[], "plain");
    let stderr = String::from_utf8(build.stderr).unwrap();
    assert_eq!(build.status.code(), Some(0), "{stderr}");
    let css = fs::read_to_string(
        path.join("mokly-static")
            .join(namespace::generated("styles/style.css")),
    )
    .unwrap();
    for input in [
        "tracked",
        "untracked",
        "ignored",
        "replaced",
        "nested",
        "submodule",
    ] {
        assert!(css.contains(&format!(".fixture-{input}")), "{input}: {css}");
    }
    assert_eq!(
        stderr,
        concat!(
            "[mokly/warning] configuration \"mokly.config.json\": module generated/skin.css is ignored by Git, so a later base cannot load it\n",
            "[mokly/warning] configuration \"mokly.config.json\": module replaced/skin.css is ignored by Git, so a later base cannot load it\n",
            "[mokly/warning] configuration \"mokly.config.json\": module vendor/nested/esm/nested.css is inside the nested repository vendor/nested, so a later base cannot load it\n",
            "[mokly/warning] configuration \"mokly.config.json\": module vendor/submodule/esm/submodule.css is inside the submodule vendor/submodule, so a later base cannot load it\n",
        )
    );
}

fn link_package(root: &Path, name: &str) {
    let modules = root.join("node_modules");
    fs::create_dir_all(&modules).unwrap();
    link_directory(&root.join("vendor").join(name), &modules.join(name));
}
