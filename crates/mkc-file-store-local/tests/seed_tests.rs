//! Seed storage lifecycle, read budgets and native path safety.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::fs::{self, File};
use std::os::unix::fs::{PermissionsExt, symlink};

use bytes::Bytes;
use mkc_file_store_interface::error::{Error, IntegrityError};
use mkc_file_store_interface::seed_name::SeedName;
use mkc_file_store_local::directory::{LocalFileStoreFactory, SeedStoreFactory};
use tempfile::TempDir;

#[test]
fn puts_and_gets_seed_objects_under_the_private_root() {
    let parent = TempDir::new().unwrap();
    let root = parent.path().join("objects");
    let store = LocalFileStoreFactory.open_seed(&root).unwrap();
    let name = SeedName::new("123-2", "request.json").unwrap();

    store.put(&name, Bytes::from_static(b"request")).unwrap();

    assert_eq!(store.get(&name, 7).unwrap(), Some(b"request".to_vec()));
    assert_eq!(fs::read(root.join(name.as_str())).unwrap(), b"request");
    assert_eq!(
        fs::metadata(root).unwrap().permissions().mode() & 0o777,
        0o700
    );
}

#[test]
fn replacing_a_seed_put_publishes_complete_new_bytes() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open_seed(root.path()).unwrap();
    let name = SeedName::new("local", "seed-status.json").unwrap();

    store
        .put(&name, Bytes::from_static(b"failed status"))
        .unwrap();
    store.put(&name, Bytes::from_static(b"seeded")).unwrap();

    assert_eq!(store.get(&name, 64).unwrap(), Some(b"seeded".to_vec()));
    let parent = root.path().join(name.as_str()).parent().unwrap().to_owned();
    assert_eq!(fs::read_dir(parent).unwrap().count(), 1);
}

#[test]
fn missing_seed_objects_return_none_without_creating_directories() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open_seed(root.path()).unwrap();
    let name = SeedName::new("local", "catalogue/plan.tar.gz").unwrap();

    assert_eq!(store.get(&name, 100 * 1024 * 1024).unwrap(), None);
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
}

#[test]
fn seed_reads_refuse_objects_over_the_read_budget() {
    let root = TempDir::new().unwrap();
    let store = LocalFileStoreFactory.open_seed(root.path()).unwrap();
    let name = SeedName::new("local", "request.json").unwrap();
    store.put(&name, Bytes::from_static(b"12345")).unwrap();

    let Error::Internal(error) = store.get(&name, 4).unwrap_err();
    assert!(matches!(
        error.source_ref().downcast_ref::<IntegrityError>(),
        Some(IntegrityError::TooLarge)
    ));
    store.put(&name, Bytes::new()).unwrap();
    assert_eq!(store.get(&name, 0).unwrap(), Some(Vec::new()));
    let Error::Internal(error) = store
        .put(&name, Bytes::from(vec![0; 64 * 1024 * 1024 + 1]))
        .unwrap_err();
    assert!(matches!(
        error.source_ref().downcast_ref::<IntegrityError>(),
        Some(IntegrityError::TooLarge)
    ));
    assert_eq!(store.get(&name, 0).unwrap(), Some(Vec::new()));

    for (file, oversized) in [
        ("catalogue/plan.tar.gz", 100 * 1024 * 1024 + 1),
        (
            "catalogue/blobs/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            64 * 1024 * 1024 + 1,
        ),
    ] {
        let name = SeedName::new("local", file).unwrap();
        let path = root.path().join(name.as_str());
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        File::create(path).unwrap().set_len(oversized).unwrap();
        let Error::Internal(error) = store.get(&name, u64::MAX).unwrap_err();
        assert!(matches!(
            error.source_ref().downcast_ref::<IntegrityError>(),
            Some(IntegrityError::TooLarge)
        ));
    }

    let plan = SeedName::new("local", "catalogue/plan.tar.gz").unwrap();
    File::create(root.path().join(plan.as_str()))
        .unwrap()
        .set_len(65 * 1024 * 1024)
        .unwrap();
    assert_eq!(
        store.get(&plan, u64::MAX).unwrap().unwrap().len(),
        65 * 1024 * 1024
    );
}

#[test]
fn seed_reads_and_writes_refuse_symlinks_and_nonfiles() {
    for entry in ["seed", "seed/local", "seed/local/request.json", "directory"] {
        let root = TempDir::new().unwrap();
        let elsewhere = TempDir::new().unwrap();
        let store = LocalFileStoreFactory.open_seed(root.path()).unwrap();
        let name = SeedName::new("local", "request.json").unwrap();
        let entry_path = root.path().join(entry);
        if entry == "directory" {
            fs::create_dir_all(root.path().join(name.as_str())).unwrap();
        } else {
            fs::create_dir_all(entry_path.parent().unwrap()).unwrap();
            symlink(elsewhere.path(), entry_path).unwrap();
        }

        for error in [
            store.get(&name, 64).unwrap_err(),
            store.put(&name, Bytes::from_static(b"status")).unwrap_err(),
        ] {
            let Error::Internal(error) = error;
            assert!(
                matches!(
                    error.source_ref().downcast_ref::<IntegrityError>(),
                    Some(IntegrityError::UnsafeEntry)
                ),
                "{entry}"
            );
        }
        assert_eq!(fs::read_dir(elsewhere.path()).unwrap().count(), 0);
    }
}
