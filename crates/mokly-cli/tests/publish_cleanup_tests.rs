//! Publication cleanup removes the allocated private root and never follows links.

use std::fs;

use mokly_cli::publication::build::{Directories, SystemDirectories};

#[test]
fn cleanup_removes_the_allocated_private_directory_with_its_reservations() {
    let repository = tempfile::tempdir().unwrap();
    let directories: &dyn Directories = &SystemDirectories;
    let private = directories.create(repository.path()).unwrap();
    assert!(private.is_dir());
    let site = private.join("site");
    fs::create_dir(&site).unwrap();
    fs::create_dir_all(private.join(".mokly-export-reservations/locks/site")).unwrap();
    fs::write(
        private.join(".mokly-export-reservations/.owner"),
        "mokly-export-reservations-v1\n",
    )
    .unwrap();
    directories.remove(&private).unwrap();
    assert!(!private.exists());
}

#[test]
fn successful_cleanup_removes_owned_siblings_but_preserves_symlink_targets() {
    let repository = tempfile::tempdir().unwrap();
    let directories: &dyn Directories = &SystemDirectories;
    let private = directories.create(repository.path()).unwrap();
    assert!(private.is_dir());
    let site = private.join("site");
    fs::create_dir(&site).unwrap();
    fs::write(site.join("index.html"), "snapshot").unwrap();
    let sibling = private.join("private-note");
    fs::write(&sibling, "owned").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(repository.path(), private.join("external")).unwrap();
    fs::write(repository.path().join("keep.txt"), "source").unwrap();
    directories.remove(&private).unwrap();
    assert!(!site.exists());
    assert!(!sibling.exists());
    assert!(!private.exists());
    assert_eq!(
        fs::read_to_string(repository.path().join("keep.txt")).unwrap(),
        "source"
    );
}
