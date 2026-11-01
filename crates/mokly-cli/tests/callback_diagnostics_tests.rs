//! Page callback warnings print and strict builds preserve the earlier output.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tempfile::TempDir;

fn workspace() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
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
    write(
        directory.path(),
        "specs/statement.mockup.ts",
        "import {definePage} from '@mokly/mokly'; export default definePage({title:'Statement',description:'',relatedDocs:[],render:()=> '<!doctype html><html><head></head><body><mokly-ignore-scope enabled=\"true\" typo=\"x\"><mokly-ignore id=\"clock\" extra=\"y\" class=\"z\">Clock</mokly-ignore></mokly-ignore-scope></body></html>'});",
    );
    directory
}

fn run(root: &Path, strict: bool) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command.args(["build", "--no-changes", "--out", "site"]);
    if strict {
        command.arg("--strict");
    }
    command
        .current_dir(root)
        .env("MOKLY_OUTPUT", "plain")
        .env("MOKLY_PACKAGE_ROOT", workspace().join("packages/mokly"))
        .output()
        .unwrap()
}

#[test]
fn page_callback_warnings_print_and_strict_keeps_existing_output() {
    let root = fixture();
    let plain = run(root.path(), false);
    assert_eq!(plain.status.code(), Some(0));
    let expected = "[mokly/warning] entry \"statement\": unknown attribute class on <mokly-ignore> is ignored\n[mokly/warning] entry \"statement\": unknown attribute extra on <mokly-ignore> is ignored\n[mokly/warning] entry \"statement\": unknown attribute typo on <mokly-ignore-scope> is ignored\n";
    assert_eq!(String::from_utf8(plain.stderr).unwrap(), expected);
    let index = fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap();
    let marker = fs::read(root.path().join("site/.mokly-export-artifact")).unwrap();

    let strict = run(root.path(), true);
    assert_eq!(strict.status.code(), Some(1));
    assert!(strict.stdout.is_empty());
    assert_eq!(
        String::from_utf8(strict.stderr).unwrap(),
        format!("{expected}[mokly/build-invalid] 3 build warnings with --strict\n")
    );
    assert_eq!(
        fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap(),
        index
    );
    assert_eq!(
        fs::read(root.path().join("site/.mokly-export-artifact")).unwrap(),
        marker
    );
}
