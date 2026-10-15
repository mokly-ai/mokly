//! Input consistency includes explicit hidden sources and ignores owned output aliases.

use std::fs;
use std::sync::Arc;

use mokly_catalogue::working_tree::WorkingTree;
use mokly_source_interface::tree::SourceTree;
use mokly_static::filesystem::SystemFiles;
use mokly_static::fingerprint::{
    CapturedTree, Fingerprints, InputTree, SourceFingerprints, verify,
};
use tempfile::TempDir;

#[test]
fn explicit_hidden_inputs_are_rechecked_and_source_membership_changes_are_seen() {
    let root = TempDir::new().unwrap();
    fs::create_dir(root.path().join(".context")).unwrap();
    let input = root.path().join(".context/helper.ts");
    fs::write(&input, "original").unwrap();
    let tree = CapturedTree::new(Arc::new(WorkingTree));
    assert_eq!(tree.read(&input).unwrap(), b"original");
    fs::write(&input, "changed").unwrap();
    assert_eq!(tree.read(&input).unwrap(), b"original");
    assert!(tree.verify().is_err());
    let fingerprints: &dyn Fingerprints = &SourceFingerprints {
        files: Arc::new(SystemFiles),
    };
    let before = fingerprints.capture(root.path(), &[]).unwrap();
    fs::write(root.path().join("new.screen.html"), "new").unwrap();
    let after = fingerprints.capture(root.path(), &[]).unwrap();
    assert!(verify(&before, &after).is_err());
}

#[cfg(unix)]
#[test]
fn escaping_dangling_and_cyclic_links_contribute_only_safe_metadata() {
    let root = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    fs::write(outside.path().join("secret"), "never read").unwrap();
    std::os::unix::fs::symlink(outside.path(), root.path().join("outside")).unwrap();
    std::os::unix::fs::symlink("absent", root.path().join("dangling")).unwrap();
    std::os::unix::fs::symlink(root.path(), root.path().join("cycle")).unwrap();
    let fingerprints: &dyn Fingerprints = &SourceFingerprints {
        files: Arc::new(SystemFiles),
    };
    let captured = fingerprints.capture(root.path(), &[]).unwrap();
    assert_eq!(captured.len(), 3);
    assert!(captured.values().all(|value| value.starts_with("link:")));
    assert!(!captured.keys().any(|path| path.ends_with("secret")));
    fs::remove_file(root.path().join("dangling")).unwrap();
    std::os::unix::fs::symlink("another", root.path().join("dangling")).unwrap();
    assert!(verify(&captured, &fingerprints.capture(root.path(), &[]).unwrap()).is_err());
}

#[cfg(unix)]
#[test]
fn canonical_output_exclusion_also_excludes_a_different_logical_alias() {
    let root = TempDir::new().unwrap();
    let output = root.path().join("output");
    fs::create_dir(&output).unwrap();
    std::os::unix::fs::symlink(&output, root.path().join("alias")).unwrap();
    let fingerprints: &dyn Fingerprints = &SourceFingerprints {
        files: Arc::new(SystemFiles),
    };
    let before = fingerprints
        .capture(root.path(), std::slice::from_ref(&output))
        .unwrap();
    fs::write(output.join("index.html"), "site").unwrap();
    let after = fingerprints.capture(root.path(), &[output]).unwrap();
    verify(&before, &after).unwrap();
    assert_eq!(before.len(), 1);
}
