//! Real OS adapter integration checks with isolated directories.

use std::fs;

use mokly_platform::error::Error;
use mokly_platform::locks::{Locks, SystemLocks};
use mokly_platform::rename::{Rename, SystemRename};
use tempfile::tempdir;

#[test]
fn exclusive_rename_never_overwrites_files_or_directories() {
    let directory = tempdir().unwrap();
    let source = directory.path().join("source");
    let destination = directory.path().join("destination");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("kept"), "source").unwrap();
    fs::create_dir(&destination).unwrap();
    fs::write(destination.join("kept"), "destination").unwrap();
    let rename: &dyn Rename = &SystemRename;
    assert!(matches!(
        rename.exclusive(&source, &destination),
        Err(Error::DestinationExists { .. })
    ));
    assert_eq!(
        fs::read_to_string(destination.join("kept")).unwrap(),
        "destination"
    );
    let moved = directory.path().join("moved");
    rename.exclusive(&source, &moved).unwrap();
    assert!(!source.exists());
    assert_eq!(fs::read_to_string(moved.join("kept")).unwrap(), "source");
    let file = directory.path().join("file");
    fs::write(&file, "source").unwrap();
    assert!(matches!(
        rename.exclusive(&file, &destination.join("kept")),
        Err(Error::DestinationExists { .. })
    ));
}

#[test]
fn locks_are_exclusive_and_release_with_the_guard() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("lock");
    let locks: &dyn Locks = &SystemLocks;
    {
        let _held = locks.try_lock(&path).unwrap();
        assert!(matches!(locks.try_lock(&path), Err(Error::Locked { .. })));
    }
    let _held = locks.try_lock(&path).unwrap();
}
