//! Compare both section readers against every stylesheet that Git lists.

use std::fs;
use std::path::Path;
use std::process::Command;

/// Every CSS file that Git lists has the same section observations.
#[test]
fn section_readers_agree_on_every_stylesheet_that_git_lists() {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = Command::new("git")
        .args([
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
            "--",
            "*.css",
        ])
        .current_dir(&repository)
        .output()
        .expect("run git ls-files");
    assert!(
        output.status.success(),
        "git ls-files failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let paths = String::from_utf8(output.stdout).expect("git returned non-UTF-8 paths");
    let mut compared = 0;
    for path in paths.split('\0').filter(|path| !path.is_empty()) {
        let stylesheet = repository.join(path);
        if !stylesheet.is_file() {
            continue;
        }
        let source = fs::read_to_string(&stylesheet)
            .unwrap_or_else(|error| panic!("cannot read {path}: {error}"));
        if let Some(message) = mokly_css::token_differential::first_difference(&source) {
            panic!("{path}: {message}");
        }
        compared += 1;
    }
    assert!(
        compared > 0,
        "Git listed no existing CSS stylesheet to compare"
    );
}
