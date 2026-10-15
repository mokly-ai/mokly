//! Cache receipt publication must not follow a stale temporary symlink.

#[cfg(unix)]
#[test]
fn temporary_receipt_links_cannot_overwrite_files_outside_the_cache() {
    let temporary = tempfile::tempdir().unwrap();
    let entry = temporary.path().canonicalize().unwrap().join("entry");
    let outside = temporary.path().join("repository-file");
    std::fs::create_dir(&entry).unwrap();
    std::fs::write(&outside, b"authored source").unwrap();
    std::os::unix::fs::symlink(&outside, entry.join("receipt.tmp")).unwrap();
    let storage: &dyn mokly_compare::cache_types::Storage = &mokly_compare::storage::SystemStorage;
    storage
        .receipt(
            &entry,
            &mokly_compare::cache_types::Receipt {
                bytes: 1024,
                used: 1,
                digest: "digest".into(),
            },
        )
        .unwrap();
    assert_eq!(std::fs::read(&outside).unwrap(), b"authored source");
    assert!(
        std::fs::symlink_metadata(entry.join("receipt.json"))
            .unwrap()
            .is_file()
    );
}
