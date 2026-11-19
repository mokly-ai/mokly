//! Plan directory checks stream discarded names while preserving physical failures.

#[cfg(unix)]
use std::ffi::OsStr;
use std::fs;
use std::io::ErrorKind;
#[cfg(unix)]
use std::os::unix::ffi::OsStrExt;

use mokly_render::physical_inputs::{PhysicalInputs, SystemPhysicalInputs};
use mokly_sidecar::compiled::{PhysicalEntry, PhysicalEntryKind, PhysicalInput};
use mokly_source_interface::error::SourceError;

use super::support::{link_directory, unlink_directory};

fn entry(name: &str, kind: PhysicalEntryKind, target: Option<String>) -> PhysicalEntry {
    PhysicalEntry {
        name: name.into(),
        kind,
        target,
    }
}

#[test]
fn plan_directory_names_ignore_only_unrelated_ascii_members() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    fs::write(root.join("value.ts"), "original").unwrap();
    fs::write(root.join("value.ts~"), "backup").unwrap();
    let expected = PhysicalInput::Directory {
        entries: vec![
            entry("value.ts", PhysicalEntryKind::File, None),
            entry("value.ts~", PhysicalEntryKind::File, None),
        ],
    };
    let names = ["value.ts".into(), "value.tsx".into()];
    let matches = || {
        SystemPhysicalInputs
            .matches_candidates(&root, &expected, &names)
            .unwrap()
    };
    assert!(matches());
    fs::remove_file(root.join("value.ts~")).unwrap();
    fs::write(root.join(".value.ts.swp"), "swap").unwrap();
    assert!(matches());
    assert!(!SystemPhysicalInputs.matches(&root, &expected).unwrap());
    fs::write(root.join("VALUE.TS"), "collision").unwrap();
    assert!(!matches());
    fs::remove_file(root.join("VALUE.TS")).unwrap();
    fs::write(root.join("Value.TSX"), "preferred").unwrap();
    assert!(!matches());
    fs::remove_file(root.join("Value.TSX")).unwrap();
    fs::remove_file(root.join("value.ts")).unwrap();
    fs::create_dir(root.join("value.ts")).unwrap();
    assert!(!matches());
    fs::remove_dir(root.join("value.ts")).unwrap();
    assert!(!matches());
}

#[test]
fn plan_directory_checks_preserve_link_errors_and_canonical_identity() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    fs::create_dir(root.join("target")).unwrap();
    link_directory(&root.join("target"), &root.join("ignored"));
    let expected = PhysicalInput::Directory {
        entries: vec![
            entry(
                "ignored",
                PhysicalEntryKind::Link,
                Some(root.join("target").to_str().unwrap().into()),
            ),
            entry("target", PhysicalEntryKind::Directory, None),
        ],
    };
    let names = ["value.ts".into()];
    assert!(
        SystemPhysicalInputs
            .matches_candidates(&root, &expected, &names)
            .unwrap()
    );
    let candidate = ["ignored".into()];
    assert!(
        SystemPhysicalInputs
            .matches_candidates(&root, &expected, &candidate)
            .unwrap()
    );
    fs::create_dir(root.join("other")).unwrap();
    unlink_directory(&root.join("ignored"));
    link_directory(&root.join("other"), &root.join("ignored"));
    assert!(
        !SystemPhysicalInputs
            .matches_candidates(&root, &expected, &candidate)
            .unwrap()
    );
    unlink_directory(&root.join("ignored"));
    link_directory(&root.join("target"), &root.join("ignored"));
    fs::remove_dir(root.join("target")).unwrap();
    assert!(
        matches!(SystemPhysicalInputs.matches_candidates(&root, &expected, &names),
        Err(SourceError::Io { operation: "check physical compilation input", path, source })
            if path == root && source.kind() == ErrorKind::NotFound)
    );
    unlink_directory(&root.join("ignored"));
    fs::create_dir(root.join("actual")).unwrap();
    link_directory(&root.join("actual"), &root.join("alias"));
    let empty = PhysicalInput::Directory { entries: vec![] };
    assert!(
        !SystemPhysicalInputs
            .matches_candidates(&root.join("alias"), &empty, &names)
            .unwrap()
    );
}

#[test]
fn current_non_ascii_names_reject_a_narrowed_directory() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    let expected = PhysicalInput::Directory { entries: vec![] };
    let names = ["key.ts".into()];
    for name in ["İ.ts", "Key.ts"] {
        fs::write(root.join(name), "unicode").unwrap();
        assert!(
            !SystemPhysicalInputs
                .matches_candidates(&root, &expected, &names)
                .unwrap()
        );
        fs::remove_file(root.join(name)).unwrap();
    }
}

#[cfg(unix)]
#[test]
fn invalid_unicode_names_reject_a_narrowed_directory() {
    let directory = tempfile::tempdir().unwrap();
    let root = dunce::canonicalize(directory.path()).unwrap();
    fs::write(root.join(OsStr::from_bytes(b"bad-\xff")), "invalid").unwrap();
    let expected = PhysicalInput::Directory { entries: vec![] };
    assert!(
        matches!(SystemPhysicalInputs.matches_candidates(&root, &expected, &["value.ts".into()]),
        Err(SourceError::Io { operation: "check physical compilation input", path, source })
            if path == root && source.kind() == ErrorKind::InvalidData)
    );
}
