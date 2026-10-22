//! Local checkout failures leave independent comparison resources usable.

use std::process::Command;

use sha2::{Digest, Sha256};

#[expect(dead_code, reason = "only the comparison fixture is needed")]
mod engine_support;
use engine_support::Fixture;

#[cfg(unix)]
#[test]
fn a_failed_base_filter_warns_and_keeps_independent_changes() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../bad.png\"><img src=\"../../good.png\">",
        ),
        (".gitattributes", "bad.png filter=bad\n"),
        ("bad.png", "pointer"),
        ("good.png", "before"),
    ]);
    for (name, value) in [
        ("filter.bad.smudge", "sh -c 'exit 42'"),
        ("filter.bad.required", "true"),
    ] {
        assert!(
            Command::new("git")
                .current_dir(fixture.directory.path())
                .args(["config", name, value])
                .status()
                .unwrap()
                .success()
        );
    }
    fixture.edit("good.png", "after");
    let result = fixture.compare().unwrap();
    assert_eq!(result.snapshot.changed_entries, ["home"]);
    assert!(result.warnings.iter().any(|warning| warning.code == "base-conversion" && warning.message.contains("bad.png")));
}

#[test]
fn crlf_checkout_bytes_equal_the_working_resource() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../image.png\">",
        ),
        (".gitattributes", "image.png text eol=crlf\n"),
        ("image.png", "one\ntwo\n"),
    ]);
    fixture.edit("image.png", "one\r\ntwo\r\n");
    let result = fixture.compare().unwrap();
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.warnings.is_empty());
}

#[test]
fn lfs_checkout_bytes_equal_the_working_resource() {
    let content = "local LFS resource\n";
    let digest = Sha256::digest(content.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let pointer = format!(
        "version https://git-lfs.github.com/spec/v1\noid sha256:{digest}\nsize {}\n",
        content.len()
    );
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../image.png\">",
        ),
        (
            ".gitattributes",
            "image.png filter=lfs diff=lfs merge=lfs -text\n",
        ),
        ("image.png", &pointer),
    ]);
    let root = fixture.directory.path();
    let object = root.join(format!(
        ".git/lfs/objects/{}/{}/{digest}",
        &digest[..2],
        &digest[2..4]
    ));
    std::fs::create_dir_all(object.parent().unwrap()).unwrap();
    std::fs::write(object, content).unwrap();
    let installed = Command::new("git")
        .current_dir(root)
        .args(["lfs", "install", "--local"])
        .output()
        .unwrap();
    assert!(installed.status.success());
    fixture.edit("image.png", content);
    let result = fixture.compare().unwrap();
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(result.warnings.is_empty());
}

#[cfg(unix)]
#[test]
fn an_unavailable_base_resource_is_not_change_proof() {
    let fixture = Fixture::new(&[
        (
            "specs/home.screen.html",
            "---\ntitle: Home\n---\n<img src=\"../../bad.png\">",
        ),
        (".gitattributes", "bad.png filter=bad\n"),
        ("bad.png", "pointer"),
    ]);
    for (name, value) in [
        ("filter.bad.smudge", "sh -c 'exit 42'"),
        ("filter.bad.required", "false"),
    ] {
        assert!(
            Command::new("git")
                .current_dir(fixture.directory.path())
                .args(["config", name, value])
                .status()
                .unwrap()
                .success()
        );
    }
    fixture.edit("bad.png", "different working data");
    let result = fixture.compare().unwrap();
    assert!(result.snapshot.changed_entries.is_empty());
    assert!(
        result
            .warnings
            .iter()
            .any(|warning| warning.code == "base-conversion")
    );
}
