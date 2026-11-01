//! Static admission accepts assets from real package-manager directory links.

#![cfg(unix)]

use std::fs;
use std::os::unix::fs::symlink;
use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

#[test]
fn unchanged_linked_package_asset_installs_static_output() {
    let root = TempDir::new().unwrap();
    for directory in [
        "specs",
        "styles",
        "node_modules/.pnpm/theme/node_modules/theme",
    ] {
        fs::create_dir_all(root.path().join(directory)).unwrap();
    }
    for (path, text) in [
        (
            "mokly.config.json",
            r#"{"stylesheets":[{"match":"**","stylesheets":["styles/main.css"]}]}"#,
        ),
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<div class=\"hero\">Home</div>",
        ),
        (
            "styles/main.css",
            ".hero{background:url('../node_modules/theme/icon.svg')}",
        ),
        (
            "node_modules/.pnpm/theme/node_modules/theme/icon.svg",
            "<svg/>",
        ),
    ] {
        fs::write(root.path().join(path), text).unwrap();
    }
    symlink(
        ".pnpm/theme/node_modules/theme",
        root.path().join("node_modules/theme"),
    )
    .unwrap();
    let viewer = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/viewer/dist")
        .canonicalize()
        .unwrap();
    let result = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes", "--strict", "--out", "site"])
        .env("PATH", "")
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_VIEWER_DIST", viewer)
        .current_dir(root.path())
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(root.path().join("site/index.html").is_file());
    assert_eq!(
        fs::read(
            root.path()
                .join("site/static/mokly-generated/assets/node_modules/theme/icon.svg")
        )
        .unwrap(),
        b"<svg/>"
    );
}
