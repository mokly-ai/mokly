//! Publication cleanup removes one snapshot and preserves unrelated neighbours.

use std::fs;

use mokly_cli::publication::build::{Directories, SystemDirectories};

#[test]
fn cleanup_removes_the_parent_when_it_has_no_other_entries() {
    let repository = tempfile::tempdir().unwrap();
    let directories: &dyn Directories = &SystemDirectories;
    let site = directories.create(repository.path()).unwrap();
    fs::create_dir(&site).unwrap();
    directories.remove(&site).unwrap();
    assert!(!site.parent().unwrap().exists());
}

#[test]
fn successful_cleanup_preserves_siblings_and_symlink_targets() {
    let repository = tempfile::tempdir().unwrap();
    let directories: &dyn Directories = &SystemDirectories;
    let site = directories.create(repository.path()).unwrap();
    let parent = site.parent().unwrap();
    fs::create_dir(&site).unwrap();
    fs::write(site.join("index.html"), "snapshot").unwrap();
    let sibling = parent.join("keep.txt");
    fs::write(&sibling, "unrelated").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(repository.path(), site.join("external")).unwrap();
    fs::write(repository.path().join("keep.txt"), "source").unwrap();
    directories.remove(&site).unwrap();
    assert!(!site.exists());
    assert_eq!(fs::read_to_string(&sibling).unwrap(), "unrelated");
    assert_eq!(
        fs::read_to_string(repository.path().join("keep.txt")).unwrap(),
        "source"
    );
    fs::remove_file(sibling).unwrap();
    fs::remove_dir(parent).unwrap();
}
