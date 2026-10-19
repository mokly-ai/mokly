//! Extglob diagnostics use the normal terminal and strict-build warning policy.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use serde_json::json;
use tempfile::TempDir;

const WARNING: &str = "[mokly/warning] configuration \"mokly.config.json\": stylesheet match \"@(home|other)/**\" uses unsupported extglob syntax. Use brace alternatives such as \"{a,b}\" instead.\n";

fn fixture(pattern: &str) -> TempDir {
    let directory = TempDir::new().unwrap();
    fs::create_dir(directory.path().join("specs")).unwrap();
    fs::write(
        directory.path().join("mokly.config.json"),
        json!({
            "colorSchemes":["light","dark"],
            "stylesheets":[{"match":pattern,"stylesheets":["theme.css"]}]
        })
        .to_string(),
    )
    .unwrap();
    fs::write(directory.path().join("theme.css"), "h1 {color: red}").unwrap();
    for name in ["home", "other"] {
        fs::write(
            directory.path().join(format!("specs/{name}.screen.html")),
            "---\ntitle: Sample\n---\n<h1>Sample</h1>",
        )
        .unwrap();
    }
    directory
}

fn run(directory: &Path, strict: bool) -> Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_mokly"));
    command.args(["build", "--no-changes", "--out", "site"]);
    if strict {
        command.arg("--strict");
    }
    command
        .current_dir(directory)
        .env("MOKLY_OUTPUT", "plain")
        .env("PATH", "")
        .env(
            "MOKLY_PACKAGE_ROOT",
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/mokly"),
        )
        .env_remove("MOKLY_NODE_EXECUTABLE")
        .env_remove("MOKLY_SIDECARS")
        .env_remove("CI")
        .output()
        .unwrap()
}

#[test]
fn extglob_warns_once_across_all_views_and_strict_preserves_existing_output() {
    let directory = fixture("@(home|other)/**");
    let output = run(directory.path(), false);
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(String::from_utf8(output.stderr).unwrap(), WARNING);
    assert!(String::from_utf8_lossy(&output.stdout).contains("Built Mokly to site"));
    let index = directory.path().join("site/mokly-viewer/index.json");
    let previous = fs::read(&index).unwrap();
    let marker = directory.path().join("site/.mokly-export-artifact");
    let previous_marker = fs::read(&marker).unwrap();
    let strict = run(directory.path(), true);
    assert_eq!(strict.status.code(), Some(1));
    assert!(strict.stdout.is_empty());
    assert_eq!(
        String::from_utf8(strict.stderr).unwrap(),
        format!("{WARNING}[mokly/build-invalid] 1 build warning with --strict\n")
    );
    assert_eq!(fs::read(&index).unwrap(), previous);
    assert_eq!(fs::read(&marker).unwrap(), previous_marker);
}

#[test]
fn brace_matcher_builds_in_strict_mode_without_warning() {
    let directory = fixture("{home,other}/**");
    let output = run(directory.path(), true);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert!(
        directory
            .path()
            .join("site/mokly-viewer/index.json")
            .is_file()
    );
}
