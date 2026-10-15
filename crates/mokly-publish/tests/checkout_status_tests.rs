//! Reservation ownership and complete real Git status records.

#[path = "support/checkout.rs"]
mod checkout_support;

use std::fs;
use std::io::Write;
use std::process::Command;

use checkout_support::{checkout, git, init};
use mokly_publish::runtime::CommandCancellation;

#[test]
fn only_exact_regular_reservation_owners_exclude_status_paths() {
    let directory = tempfile::tempdir().unwrap();
    init(directory.path(), false);
    let namespace = directory.path().join(".mokly-export-reservations");
    fs::create_dir(&namespace).unwrap();
    let owner = namespace.join(".owner");
    let cancellation = CommandCancellation::default();
    let checkout = checkout();
    for bytes in [
        b"wrong".as_slice(),
        b"mokly-export-reservations-v1\nextra",
        b"mokly-export-reservations-v1\n",
    ] {
        fs::write(&owner, bytes).unwrap();
        let paths = checkout
            .inspect(directory.path(), &[], &cancellation)
            .unwrap()
            .changed_paths;
        assert_eq!(paths.is_empty(), bytes == b"mokly-export-reservations-v1\n");
    }
    fs::remove_file(&owner).unwrap();
    fs::create_dir(&owner).unwrap();
    fs::write(owner.join("authored.txt"), "not a regular owner").unwrap();
    assert_eq!(
        checkout
            .inspect(directory.path(), &[], &cancellation)
            .unwrap()
            .changed_paths,
        [".mokly-export-reservations/.owner/authored.txt"]
    );
}

#[cfg(unix)]
#[test]
fn a_symlink_owner_does_not_exclude_an_unowned_namespace() {
    let directory = tempfile::tempdir().unwrap();
    init(directory.path(), false);
    let namespace = directory.path().join(".mokly-export-reservations");
    fs::create_dir(&namespace).unwrap();
    let external = tempfile::NamedTempFile::new().unwrap();
    fs::write(external.path(), b"mokly-export-reservations-v1\n").unwrap();
    std::os::unix::fs::symlink(external.path(), namespace.join(".owner")).unwrap();
    assert_eq!(
        checkout()
            .inspect(directory.path(), &[], &CommandCancellation::default())
            .unwrap()
            .changed_paths,
        [".mokly-export-reservations/.owner"]
    );
}

#[test]
fn deleted_type_changed_unmerged_and_ignored_paths_follow_git_status() {
    let directory = tempfile::tempdir().unwrap();
    init(directory.path(), false);
    let root = directory.path();
    let cancellation = CommandCancellation::default();
    let checkout = checkout();
    fs::write(root.join(".gitignore"), "ignored/\n").unwrap();
    git(root, &["add", ".gitignore"]);
    git(root, &["commit", "-qm", "ignore local output"]);
    fs::create_dir(root.join("ignored")).unwrap();
    fs::write(root.join("ignored/file"), "ignored").unwrap();
    assert!(
        checkout
            .inspect(root, &[], &cancellation)
            .unwrap()
            .changed_paths
            .is_empty()
    );
    fs::remove_file(root.join("source.txt")).unwrap();
    assert_eq!(
        checkout
            .inspect(root, &[], &cancellation)
            .unwrap()
            .changed_paths,
        ["source.txt"]
    );
    git(root, &["checkout", "--", "source.txt"]);
    let object = git(root, &["hash-object", "-w", "source.txt"]);
    let object = object.trim();
    git(
        root,
        &[
            "update-index",
            "--cacheinfo",
            &format!("120000,{object},source.txt"),
        ],
    );
    assert_eq!(
        checkout
            .inspect(root, &[], &cancellation)
            .unwrap()
            .changed_paths,
        ["source.txt"]
    );
    git(root, &["reset", "--hard", "HEAD"]);
    let mut command = Command::new("git");
    command
        .current_dir(root)
        .args(["update-index", "--index-info"])
        .stdin(std::process::Stdio::piped());
    let mut child = command.spawn().unwrap();
    {
        let mut input = child.stdin.take().unwrap();
        write!(input,"0 {}\tsource.txt\n100644 {object} 1\tsource.txt\n100644 {object} 2\tsource.txt\n100644 {object} 3\tsource.txt\n","0".repeat(40)).unwrap();
    }
    assert!(child.wait().unwrap().success());
    assert_eq!(
        checkout
            .inspect(root, &[], &cancellation)
            .unwrap()
            .changed_paths,
        ["source.txt"]
    );
}
