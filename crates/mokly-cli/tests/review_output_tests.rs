//! Collision continuation lines and repository-relative configuration diagnostics.

use std::fs;
use std::path::Path;
use std::process::Command;

use tempfile::TempDir;

fn write(root: &Path, path: &str, text: &str) {
    let path = root.join(path);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn failure(root: &Path, config: &str, mode: &str) -> String {
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--config", config])
        .current_dir(root)
        .env("MOKLY_OUTPUT", mode)
        .env("NO_COLOR", "1")
        .env("COLUMNS", "80")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    String::from_utf8(output.stderr).unwrap()
}

#[test]
fn duplicate_and_case_collisions_preserve_each_location_line() {
    for (first, second, code, heading) in [
        (
            "a.md",
            "a.screen.html",
            "duplicate-path",
            "path a is defined twice:",
        ),
        (
            "Home.md",
            "home.screen.html",
            "case-collision",
            "paths Home and home differ only by letter case:",
        ),
    ] {
        let directory = TempDir::new().unwrap();
        write(directory.path(), "mokly.config.json", "{}");
        write(directory.path(), &format!("specs/{first}"), "# Home");
        write(
            directory.path(),
            &format!("specs/{second}"),
            "---\ntitle: Home\n---\n<h1>Home</h1>",
        );
        let plain = failure(directory.path(), "mokly.config.json", "plain");
        assert_eq!(
            plain,
            format!(
                "[mokly/build-invalid] [mokly/{code}] {heading}\n  specs/{first}\n  specs/{second}\n"
            )
        );
        let rich = failure(directory.path(), "mokly.config.json", "rich");
        assert!(
            rich.contains(&format!("    specs/{first}\n    specs/{second}\n")),
            "{rich}"
        );
        assert!(!rich.contains("\\u000a"));
    }
}

#[test]
fn config_errors_have_one_code_and_a_repository_relative_location() {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        "tools/mokly.config.json",
        "{\n  \"repoRoot\": \"..\",\n  \"colourSchemes\": []\n}",
    );
    for mode in ["plain", "rich"] {
        let text = failure(directory.path(), "tools/mokly.config.json", mode);
        assert_eq!(text.matches("[mokly/config-invalid]").count(), 1, "{text}");
        assert!(text.contains("tools/mokly.config.json:3:3"), "{text}");
        assert!(
            text.contains("unknown configuration field: colourSchemes"),
            "{text}"
        );
        if mode == "plain" {
            assert_eq!(
                text,
                "[mokly/config-invalid] tools/mokly.config.json:3:3 unknown configuration field: colourSchemes\n"
            );
        }
    }
    let text = failure(directory.path(), "nope.json", "plain");
    assert_eq!(text, "[mokly/config-invalid] nope.json: ENOENT\n");
}

#[test]
fn configurations_outside_their_repo_root_use_the_basename() {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        "tools/mokly.config.json",
        "{\n  \"repoRoot\": \"../app\",\n  \"colourSchemes\": []\n}",
    );
    fs::create_dir(directory.path().join("app")).unwrap();
    for mode in ["plain", "rich"] {
        let text = failure(directory.path(), "tools/mokly.config.json", mode);
        assert!(
            !text.contains(&directory.path().display().to_string()),
            "{text}"
        );
        assert!(
            text.contains("mokly.config.json:3:3 unknown configuration field: colourSchemes"),
            "{text}"
        );
    }
}

#[cfg(unix)]
#[test]
fn configurations_reached_through_a_directory_symlink_keep_relative_locations() {
    let directory = TempDir::new().unwrap();
    write(
        directory.path(),
        "real/mokly.config.json",
        "{\n  \"repoRoot\": \".\",\n  \"colourSchemes\": []\n}",
    );
    std::os::unix::fs::symlink("real", directory.path().join("link")).unwrap();
    for config in ["real/mokly.config.json", "link/mokly.config.json"] {
        for mode in ["plain", "rich"] {
            let text = failure(directory.path(), config, mode);
            assert!(
                !text.contains(&directory.path().display().to_string()),
                "{text}"
            );
            assert!(
                text.contains("mokly.config.json:3:3 unknown configuration field: colourSchemes"),
                "{text}"
            );
        }
    }
}
