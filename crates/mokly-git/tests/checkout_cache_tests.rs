//! Checkout cache keys include effective attributes and external filter execution.

use std::fs;

use mokly_git::identity::RepoPath;

mod support;
use support::Fixture;

#[test]
fn source_keys_follow_external_attribute_file_contents() {
    let fixture = Fixture::new();
    fixture.write("notes.txt", b"base\n");
    let commit = fixture.commit();
    let external = tempfile::tempdir().unwrap();
    let attributes = external.path().join("attributes");
    fs::write(&attributes, "*.txt text eol=lf\n").unwrap();
    fixture.git(&[
        "config",
        "core.attributesFile",
        attributes.to_str().unwrap(),
    ]);
    let repository = fixture.repository();
    let before = repository.source_key(&commit).unwrap();
    fs::write(&attributes, "*.txt text eol=crlf\n").unwrap();
    assert_ne!(before, repository.source_key(&commit).unwrap());
    assert_eq!(
        repository
            .read(&commit, &RepoPath::parse("notes.txt").unwrap(), 32)
            .unwrap(),
        b"base\r\n"
    );
}

#[cfg(unix)]
#[test]
fn external_filters_do_not_reuse_a_stale_source_key() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"*.txt filter=custom\n");
    fixture.write("notes.txt", b"base\n");
    let commit = fixture.commit();
    fixture.git(&["config", "filter.custom.smudge", "cat"]);
    let repository = fixture.repository();
    assert_ne!(
        repository.source_key(&commit).unwrap(),
        repository.source_key(&commit).unwrap()
    );
}

#[test]
fn literal_filter_state_names_do_not_reuse_a_stale_source_key() {
    for driver in ["unset", "unspecified"] {
        let fixture = Fixture::new();
        fixture.write(
            ".gitattributes",
            format!("*.txt filter={driver}\n").as_bytes(),
        );
        fixture.write("notes.txt", b"base\n");
        let commit = fixture.commit();
        fixture.git(&["config", &format!("filter.{driver}.smudge"), "cat"]);
        let repository = fixture.repository();
        assert_ne!(
            repository.source_key(&commit).unwrap(),
            repository.source_key(&commit).unwrap(),
            "{driver}"
        );
    }
}
