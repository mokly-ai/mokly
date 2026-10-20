//! Unknown ignore-wrapper attributes warn before strict output installation.

use std::fs;
use std::path::Path;
use std::process::Command;

#[test]
fn unknown_ignore_attributes_warn_once_and_strict_preserves_output() {
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/home.screen.html"),
        "---\ntitle: Home\nvariants: [{slug: other, title: Other}]\n---\n<mokly-ignore-scope enabled='true' typo='ignored'><mokly-ignore id='clock' extra='{{missing}}'><p>Clock</p></mokly-ignore></mokly-ignore-scope>",
    )
    .unwrap();
    let mut previous = None;
    for strict in [false, true] {
        let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
        command.args(["build", "--no-changes", "--out", "site"]);
        if strict {
            command.arg("--strict");
        }
        let output = command
            .current_dir(root.path())
            .env("MOKLY_OUTPUT", "plain")
            .env("PATH", "")
            .env(
                "MOKLY_PACKAGE_ROOT",
                Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
            )
            .output()
            .unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        assert_eq!(output.status.code(), Some(i32::from(strict)), "{stderr}");
        assert_eq!(stderr.matches("[mokly/warning]").count(), 2, "{stderr}");
        assert!(stderr.contains("unknown attribute extra on <mokly-ignore> is ignored"));
        assert!(stderr.contains("unknown attribute typo on <mokly-ignore-scope> is ignored"));
        let index = fs::read(root.path().join("site/mokly-viewer/index.json")).unwrap();
        if let Some(previous) = previous {
            assert_eq!(index, previous);
            assert!(stderr.contains("2 build warnings with --strict"));
        } else {
            let html = fs::read_to_string(
                root.path()
                    .join("site/static/mokly-generated/home/index.mobile.html"),
            )
            .unwrap();
            assert!(html.contains("<p>Clock</p>"));
            assert!(!html.contains("mokly-ignore") && !html.contains("missing"));
        }
        previous = Some(index);
    }
}
