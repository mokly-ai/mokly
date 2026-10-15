//! Discovery and rendering use one exact location and nested-code format.

use std::fs;
use std::process::Command;

use tempfile::TempDir;

fn failure(source: &str, extension: &str) -> String {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join("specs")).unwrap();
    fs::write(root.path().join("mokly.config.json"), "{}").unwrap();
    fs::write(
        root.path().join("specs/new.screen.html"),
        "---\ntitle: New\nmovedFrom: old\n---\n<p>New</p>",
    )
    .unwrap();
    fs::write(root.path().join(format!("specs/a.{extension}")), source).unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(["build", "--no-changes"])
        .env("MOKLY_OUTPUT", "plain")
        .env_remove("MOKLY_SIDECARS")
        .current_dir(root.path())
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    String::from_utf8(output.stderr).unwrap()
}

#[test]
fn discovery_element_errors_use_the_render_location_separator() {
    assert_eq!(
        failure(
            "---\ntitle: A\n---\n<ui-missing></ui-missing>",
            "screen.html"
        ),
        "[mokly/build-invalid] specs/a.screen.html:4:1: [mokly/html-element] unknown element ui-missing\n"
    );
}

#[test]
fn literal_markdown_targets_use_link_coordinates_without_repeating_the_file() {
    for source in [
        "---\ntitle: A\n---\n\nRead [Missing](mock:nowhere).\n",
        "\u{feff}---\r\ntitle: A\r\n---\r\n\r\nRead [Missing](mock:nowhere).\r\n",
    ] {
        assert_eq!(
            failure(source, "md"),
            "[mokly/build-invalid] specs/a.md:5:6: [mokly/unknown-link-target] link target nowhere does not exist\n"
        );
    }
}

#[test]
fn literal_html_targets_do_not_repeat_the_file() {
    assert_eq!(
        failure(
            "---\ntitle: A\n---\n<a href=\"mock:nowhere\">Go</a>",
            "screen.html"
        ),
        "[mokly/build-invalid] specs/a.screen.html:4:4: [mokly/unknown-link-target] link target nowhere does not exist\n"
    );
}

#[test]
fn moved_markdown_targets_use_the_link_coordinate_and_nested_code() {
    assert_eq!(
        failure("Read [Moved](mock:old).", "md"),
        "[mokly/build-invalid] specs/a.md:1:6: [mokly/moved-link-target] link target old does not exist; it moved to new\n"
    );
}
