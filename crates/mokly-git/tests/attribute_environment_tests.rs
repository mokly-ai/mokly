//! Historical attributes stay pinned when a caller exports another attribute source.

use std::process::Command;

use mokly_git::identity::{ObjectId, RepoPath};

mod support;
use support::Fixture;

#[test]
fn inherited_attribute_override_probe() {
    let Some(root) = std::env::var_os("MOKLY_TEST_ATTRIBUTE_ROOT") else {
        return;
    };
    let repositories: &dyn mokly_git::repository::Repositories =
        &mokly_git::repository::GitRepositories {
            runner: support::runner(std::sync::Arc::new(mokly_git::control::Token::default())),
            disk: std::sync::Arc::new(mokly_git::disk::SystemDisk),
        };
    let repository = repositories.open(std::path::Path::new(&root)).unwrap();
    let base = ObjectId::parse(&std::env::var("MOKLY_TEST_ATTRIBUTE_BASE").unwrap()).unwrap();
    assert_eq!(
        repository
            .read(&base, &RepoPath::parse("notes.txt").unwrap(), 64)
            .unwrap(),
        b"base\r\n"
    );
}

#[test]
fn inherited_attribute_source_cannot_replace_the_base_attributes() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"*.txt text eol=crlf\n");
    fixture.write("notes.txt", b"base\n");
    let base = fixture.commit();
    fixture.write(".gitattributes", b"*.txt -text\n");
    fixture.commit();
    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("notes.txt").unwrap(), 64)
            .unwrap(),
        b"base\r\n"
    );
    let output = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "inherited_attribute_override_probe",
            "--nocapture",
        ])
        .env("MOKLY_TEST_ATTRIBUTE_ROOT", fixture.root())
        .env("MOKLY_TEST_ATTRIBUTE_BASE", base.as_str())
        .env("GIT_ATTR_SOURCE", "HEAD")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
}
