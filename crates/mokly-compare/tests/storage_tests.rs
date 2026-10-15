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
    let storage: &dyn mokly_compare::cache_types::Storage =
        &mokly_compare::storage::SystemStorage {
            root: temporary.path().canonicalize().unwrap(),
            cancellation: std::sync::Arc::new(mokly_git::control::Token::default()),
        };
    storage
        .receipt(
            &entry,
            &mokly_compare::cache_types::Receipt {
                bytes: 1024,
                used: 1,
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

#[test]
fn cache_walks_observe_cancellation() {
    let temporary = tempfile::tempdir().unwrap();
    std::fs::write(temporary.path().join("file"), b"bytes").unwrap();
    let token = std::sync::Arc::new(mokly_git::control::Token::default());
    token.cancel();
    let storage: &dyn mokly_compare::cache_types::Storage =
        &mokly_compare::storage::SystemStorage {
            root: temporary.path().canonicalize().unwrap(),
            cancellation: token,
        };
    assert!(matches!(
        storage.size(&temporary.path().canonicalize().unwrap(), 10000),
        Err(mokly_compare::error::Error::Cancelled)
    ));
    assert!(matches!(
        storage.synchronize(&temporary.path().canonicalize().unwrap()),
        Err(mokly_compare::error::Error::Cancelled)
    ));
}

#[cfg(unix)]
#[test]
fn location_resolves_namespace_links_once_and_accepts_an_external_cache_disk() {
    let temporary = tempfile::tempdir().unwrap();
    let repository = temporary.path().join("repository");
    let disk = temporary.path().join("disk");
    let cache_home = temporary.path().join("cache-home");
    std::fs::create_dir(&repository).unwrap();
    std::fs::create_dir(&disk).unwrap();
    std::fs::create_dir(&cache_home).unwrap();
    std::os::unix::fs::symlink(&disk, cache_home.join("mokly")).unwrap();
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "location_probe", "--nocapture"])
        .env("MOKLY_CACHE_LOCATION_PROBE", &repository)
        .env("XDG_CACHE_HOME", &cache_home)
        .env("MOKLY_CACHE_EXPECTED_DISK", &disk)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
}

#[cfg(unix)]
#[test]
fn location_probe() {
    let Some(repository) = std::env::var_os("MOKLY_CACHE_LOCATION_PROBE") else {
        return;
    };
    let locations: &dyn mokly_compare::locations::Locations =
        &mokly_compare::locations::SystemLocations;
    let root = locations
        .repository(std::path::Path::new(&repository))
        .unwrap();
    let expected =
        std::fs::canonicalize(std::env::var_os("MOKLY_CACHE_EXPECTED_DISK").unwrap()).unwrap();
    assert!(root.starts_with(expected));
    let storage: &dyn mokly_compare::cache_types::Storage =
        &mokly_compare::storage::SystemStorage {
            root: root.clone(),
            cancellation: std::sync::Arc::new(mokly_git::control::Token::default()),
        };
    storage.prepare(&root.join("sources")).unwrap();
}
