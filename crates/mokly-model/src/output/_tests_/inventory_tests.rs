//! Ordinary output admission keeps portable paths, collisions, and the file limit.

use bytes::Bytes;

use crate::output::error::AdmissionError;
use crate::output::inventory::Inventory;

#[test]
fn rejects_unsafe_names_and_each_collision_direction() {
    for path in ["", "../a", "/a", "a//b", "a:b", "a\\b", "a\u{85}b"] {
        let mut inventory = Inventory::default();
        assert!(matches!(
            inventory.insert(path.into(), b"".as_slice().into()),
            Err(AdmissionError::Portable { path: rejected }) if rejected == path
        ));
    }
    for (first, second, other) in [
        ("a", "A", "a"),
        ("a", "a/b", "a"),
        ("A/b", "a", "A/b"),
        (
            "ordinary",
            ".mokly-export-artifact",
            ".mokly-export-artifact",
        ),
        (
            "ordinary",
            ".MOKLY-export-artifact/child",
            ".mokly-export-artifact",
        ),
    ] {
        let mut inventory = Inventory::default();
        inventory
            .insert(first.into(), b"x".as_slice().into())
            .unwrap();
        assert!(matches!(
            inventory.insert(second.into(), b"x".as_slice().into()),
            Err(AdmissionError::Collision { path, other: existing })
                if path == second && existing == other
        ));
    }
    let mut inventory = Inventory::default();
    for path in ["ß.html", "ss.html", "a\u{200d}b", "a+b.js", "覆盖.pdf"] {
        inventory
            .insert(path.into(), b"x".as_slice().into())
            .unwrap();
    }
    assert_eq!(inventory.files().len(), 5);
}

#[test]
fn rejects_above_64_mib_and_admits_the_exact_limit_without_reserving_the_failed_path() {
    let bytes: Bytes = vec![0; 67_108_865].into();
    let mut inventory = Inventory::default();
    assert!(matches!(
        inventory.insert("ordinary.bin".into(), bytes.clone()),
        Err(AdmissionError::TooLarge { path }) if path == "ordinary.bin"
    ));
    inventory
        .insert("ordinary.bin".into(), bytes.slice(..67_108_864))
        .unwrap();
    let files: Vec<_> = inventory.files().collect();
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path, "ordinary.bin");
    assert_eq!(files[0].bytes.len(), 67_108_864);
}
