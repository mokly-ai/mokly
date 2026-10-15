//! The built CLI validates HTML catalogues and skips Changes when requested.

use std::fs;
use std::path::Path;
use std::process::{Command, Output};

use tempfile::TempDir;

fn write(directory: &Path, path: &str, text: &str) {
    let path = directory.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn run(directory: &Path, args: &[&str], mode: &str) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(args)
        .current_dir(directory)
        .env("MOKLY_OUTPUT", mode)
        .env("PATH", "")
        .env_remove("MOKLY_SIDECARS")
        .env_remove("CI")
        .output()
        .unwrap()
}

#[test]
fn plain_and_rich_builds_report_only_the_work_performed() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>\n",
    );
    write(directory.path(), "specs/guide.md", "# Guide\n");
    for mode in ["plain", "rich"] {
        let output = run(directory.path(), &["build", "--no-changes"], mode);
        assert_eq!(
            output.status.code(),
            Some(0),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
        assert_eq!(
            String::from_utf8(output.stdout).unwrap(),
            if mode == "plain" {
                ""
            } else {
                "  ✔ Catalogue ready · 1 screen · 1 document\n"
            }
        );
        assert!(!directory.path().join("mokly-static").exists());
    }
}

#[test]
fn warnings_print_once_and_strict_fails_before_any_write() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\nprops: {label: Hello}\n---\n<h1>Home</h1>\n",
    );
    write(directory.path(), "existing/sentinel.txt", "keep");
    let warning = "[mokly/warning] entry \"home\": prop \"label\" is not read by the body\n";
    let output = run(
        directory.path(),
        &["build", "--no-changes", "--out", "existing"],
        "plain",
    );
    assert_eq!(output.status.code(), Some(0));
    assert!(output.stdout.is_empty());
    assert_eq!(String::from_utf8(output.stderr).unwrap(), warning);
    let output = run(
        directory.path(),
        &["build", "--no-changes", "--strict", "--out", "existing"],
        "plain",
    );
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        format!("{warning}[mokly/build-invalid] 1 build warning with --strict\n")
    );
    assert_eq!(
        fs::read_to_string(directory.path().join("existing/sentinel.txt")).unwrap(),
        "keep"
    );
    assert_eq!(
        fs::read_dir(directory.path().join("existing"))
            .unwrap()
            .count(),
        1
    );
}

#[test]
fn config_search_and_explicit_paths_do_not_depend_on_the_package_directory() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(directory.path(), "specs/guide.md", "# Guide");
    fs::create_dir_all(directory.path().join("nested/deep")).unwrap();
    let output = run(
        &directory.path().join("nested/deep"),
        &["build", "--no-changes"],
        "plain",
    );
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    fs::rename(
        directory.path().join("mokly.config.json"),
        directory.path().join("catalogue.json"),
    )
    .unwrap();
    let output = run(
        &directory.path().join("nested/deep"),
        &["build", "--no-changes", "--config", "../../catalogue.json"],
        "plain",
    );
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn html_errors_report_the_exact_one_based_source_location() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<main><ui-missing></ui-missing></main>\n",
    );
    let output = run(directory.path(), &["build", "--no-changes"], "plain");
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/build-invalid] specs/home.screen.html:4:7: [mokly/html-element] unknown element ui-missing\n"
    );
}

#[test]
fn a_deferred_javascript_file_cannot_report_a_complete_catalogue() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<h1>Home</h1>",
    );
    write(
        directory.path(),
        "specs/entry.mockup.ts",
        "export default definition;",
    );
    let output = run(directory.path(), &["build", "--no-changes"], "plain");
    assert_eq!(output.status.code(), Some(1));
    assert!(
        String::from_utf8(output.stderr)
            .unwrap()
            .contains("JavaScript rendering is unavailable for specs/entry.mockup.ts")
    );
    assert!(output.stdout.is_empty());
}

#[test]
fn render_warnings_survive_a_later_failure_and_hide_internal_error_prefixes() {
    let directory = TempDir::new().unwrap();
    write(directory.path(), "mokly.config.json", "{}");
    write(
        directory.path(),
        "specs/home.screen.html",
        "---\ntitle: Home\n---\n<label><div to=\"home\">Home</div></label><a href=\"#missing\">Missing</a>",
    );
    let output = run(directory.path(), &["build", "--no-changes"], "plain");
    assert_eq!(output.status.code(), Some(1));
    let error = String::from_utf8(output.stderr).unwrap();
    assert_eq!(error.matches("[mokly/warning]").count(), 2);
    assert!(error.contains("MockLink child control is inside <label>"));
    assert!(error.contains("missing anchor"));
    assert!(!error.contains("[mokly-graph/"));
    assert!(!error.contains("[mokly-html"));
    assert!(error.find("[mokly/warning]").unwrap() < error.find("[mokly/build-invalid]").unwrap());
}
