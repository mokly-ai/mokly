//! The Git and file-system adapter of the fingerprint.

use std::ffi::OsStr;
use std::fs;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::os::unix::net::UnixListener;

use tempfile::TempDir;

use crate::source_tree::error::Error;

use super::super::tree_fixture::TreeFixture;
use super::{Entry, SystemTree, TreeSystem};

#[test]
fn entries_report_files_executables_links_directories_and_other_types() {
    let directory = TempDir::new().unwrap();
    let root = directory.path();
    fs::write(root.join("file"), "plain").unwrap();
    fs::write(root.join("tool"), "#!/bin/sh\n").unwrap();
    fs::set_permissions(root.join("tool"), fs::Permissions::from_mode(0o744)).unwrap();
    symlink("file", root.join("link")).unwrap();
    fs::create_dir(root.join("directory")).unwrap();
    let _socket = UnixListener::bind(root.join("socket")).unwrap();
    let tree = SystemTree;
    assert_eq!(
        tree.entry(&root.join("file")).unwrap(),
        Some(Entry::File { executable: false })
    );
    assert_eq!(
        tree.entry(&root.join("tool")).unwrap(),
        Some(Entry::File { executable: true })
    );
    assert_eq!(
        tree.entry(&root.join("link")).unwrap(),
        Some(Entry::Symlink)
    );
    assert_eq!(
        tree.entry(&root.join("directory")).unwrap(),
        Some(Entry::Directory)
    );
    assert_eq!(
        tree.entry(&root.join("socket")).unwrap(),
        Some(Entry::Other)
    );
}

#[test]
fn missing_paths_and_paths_below_a_file_have_no_entry() {
    let directory = TempDir::new().unwrap();
    fs::write(directory.path().join("file"), "plain").unwrap();
    let tree = SystemTree;
    assert_eq!(tree.entry(&directory.path().join("missing")).unwrap(), None);
    assert_eq!(
        tree.entry(&directory.path().join("file/below")).unwrap(),
        None
    );
}

#[test]
fn links_return_their_raw_target_bytes_and_files_their_bytes() {
    let directory = TempDir::new().unwrap();
    let target: &[u8] = if cfg!(target_os = "linux") {
        &[b'x', 0xff]
    } else {
        "é".as_bytes()
    };
    symlink(OsStr::from_bytes(target), directory.path().join("link")).unwrap();
    fs::write(directory.path().join("file"), [0, 1, 2]).unwrap();
    let tree = SystemTree;
    assert_eq!(
        tree.read_link(&directory.path().join("link")).unwrap(),
        target
    );
    assert_eq!(
        tree.read_file(&directory.path().join("file")).unwrap(),
        [0, 1, 2]
    );
    assert!(matches!(
        tree.read_file(&directory.path().join("missing")),
        Err(Error::Read { .. })
    ));
}

#[test]
fn git_listings_and_head_come_from_the_repository() {
    let fixture = TreeFixture::committed();
    fs::write(fixture.path("new.txt"), "new").unwrap();
    let tree = SystemTree;
    let index = String::from_utf8(tree.index(&fixture.root()).unwrap()).unwrap();
    assert!(index.starts_with("100644 "), "{index}");
    assert!(index.ends_with("\tfile.txt\0"), "{index}");
    assert_eq!(tree.untracked(&fixture.root()).unwrap(), b"new.txt\0");
    assert_eq!(
        tree.head(&fixture.root()).unwrap(),
        format!("{}\n", fixture.git(&["rev-parse", "HEAD"])).into_bytes()
    );
}

#[test]
fn a_git_failure_names_its_command_and_standard_error() {
    let directory = TempDir::new().unwrap();
    let error = SystemTree.index(directory.path()).unwrap_err();
    let Error::GitCommand { command, stderr } = &error else {
        panic!("{error}");
    };
    assert_eq!(command, "git ls-files --stage -z");
    assert!(stderr.contains("not a git repository"), "{stderr}");
}
