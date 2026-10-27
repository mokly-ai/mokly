//! File-type changes after a Testbox sync, where `HEAD` and the index stay at
//! the comparison commit, keep the fingerprint of the committed tree.

use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};

use crate::source_tree::records::{Mode, Record, fingerprint_records};

use super::tree_fixture::TreeFixture;

const NESTED: &str = "ignore or remove a nested repository or worktree";

#[test]
fn file_to_directory_keeps_the_committed_fingerprint_with_a_base_index() {
    let fixture = TreeFixture::empty();
    fixture.write("a", "base\n");
    let base = fixture.commit();
    fs::remove_file(fixture.path("a")).unwrap();
    fixture.write("a/b", "changed\n");
    fixture.box_state(&base);
    let before = fixture.fingerprint().unwrap();
    fixture.git(&["add", "-A"]);
    assert_eq!(before, fixture.fingerprint().unwrap());
}

#[test]
fn directory_to_file_keeps_the_committed_fingerprint_with_a_base_index() {
    let fixture = TreeFixture::empty();
    fixture.write("x/y", "base\n");
    let base = fixture.commit();
    fs::remove_dir_all(fixture.path("x")).unwrap();
    fixture.write("x", "changed\n");
    fixture.box_state(&base);
    let before = fixture.fingerprint().unwrap();
    fixture.git(&["add", "-A"]);
    assert_eq!(before, fixture.fingerprint().unwrap());
}

#[test]
fn a_leading_directory_symlink_cannot_add_a_cached_descendant_to_the_fingerprint() {
    let fixture = TreeFixture::empty();
    fixture.write("x/y", "base\n");
    fixture.write("target/y", "target\n");
    let base = fixture.commit();
    fs::remove_dir_all(fixture.path("x")).unwrap();
    symlink("target", fixture.path("x")).unwrap();
    fixture.box_state(&base);
    let before = fixture.fingerprint().unwrap();
    fixture.git(&["add", "-A"]);
    assert_eq!(before, fixture.fingerprint().unwrap());
}

#[test]
fn a_nested_repository_replacing_a_cached_file_is_rejected_without_an_untracked_entry() {
    let fixture = TreeFixture::empty();
    fixture.write("a", "base\n");
    let base = fixture.commit();
    fs::remove_file(fixture.path("a")).unwrap();
    fixture.nested("a");
    fixture.box_state(&base);
    assert_eq!(
        fixture.git(&["ls-files", "--others", "--exclude-standard"]),
        ""
    );
    let error = fixture.fingerprint().unwrap_err().to_string();
    assert!(
        error.contains(&format!("unsupported file type at \"a\"; {NESTED}")),
        "{error}"
    );
}

#[test]
fn a_nested_repository_inside_a_directory_replacing_a_cached_file_is_rejected() {
    let fixture = TreeFixture::empty();
    fixture.write("a", "base\n");
    let base = fixture.commit();
    fs::remove_file(fixture.path("a")).unwrap();
    fixture.nested("a/child");
    fixture.box_state(&base);
    let error = fixture.fingerprint().unwrap_err().to_string();
    assert!(error.contains("unsupported file type"), "{error}");
    assert!(error.contains(NESTED), "{error}");
}

#[test]
fn ordinary_changes_keep_the_exact_record_fingerprint_before_and_after_staging() {
    let fixture = TreeFixture::empty();
    fixture.write("a", "base\n");
    fixture.write("remove", "deleted\n");
    fixture.write(".gitignore", "ignored/\n");
    let base = fixture.commit();
    fixture.write("a", "changed\n");
    fs::set_permissions(fixture.path("a"), fs::Permissions::from_mode(0o755)).unwrap();
    fs::remove_file(fixture.path("remove")).unwrap();
    fixture.write("new", "added\n");
    symlink("missing", fixture.path("link")).unwrap();
    fixture.box_state(&base);
    fixture.write("untracked", "untracked\n");
    fixture.write("ignored/output", "ignored\n");
    let expected = fingerprint_records(&[
        Record::new(Mode::Regular, b".gitignore".to_vec(), b"ignored/\n"),
        Record::new(Mode::Executable, b"a".to_vec(), b"changed\n"),
        Record::new(Mode::Regular, b"new".to_vec(), b"added\n"),
        Record::new(Mode::Symlink, b"link".to_vec(), b"missing"),
        Record::new(Mode::Regular, b"untracked".to_vec(), b"untracked\n"),
    ])
    .to_string();
    assert_eq!(fixture.fingerprint().unwrap(), expected);
    fixture.git(&["add", "-A"]);
    assert_eq!(fixture.fingerprint().unwrap(), expected);
}

#[test]
fn an_empty_plain_directory_replacing_a_cached_file_counts_as_a_deletion() {
    let fixture = TreeFixture::empty();
    fixture.write("a", "base\n");
    let base = fixture.commit();
    fs::remove_file(fixture.path("a")).unwrap();
    fixture.box_state(&base);
    let deleted = fixture.fingerprint().unwrap();
    fs::create_dir(fixture.path("a")).unwrap();
    assert_eq!(fixture.fingerprint().unwrap(), deleted);
}
