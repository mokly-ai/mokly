//! Host install evidence sees package-manager records and scoped entry changes.

use std::fs;
use std::sync::Arc;

use mokly_compare::base_freshness::InstallInputs;
use mokly_compare::install_inputs::SystemInstallInputs;
use mokly_git::control::Token;
use mokly_git::tree::Limits;

#[test]
fn install_evidence_changes_for_records_and_package_entries_but_not_package_contents() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join("node_modules");
    fs::create_dir_all(root.join("@scope/package")).unwrap();
    fs::write(root.join(".package-lock.json"), b"one").unwrap();
    let reader: &dyn InstallInputs = &SystemInstallInputs {
        cancellation: Arc::new(Token::default()),
    };
    let original = reader.read(&root).unwrap().unwrap();
    fs::write(root.join(".package-lock.json"), b"two").unwrap();
    assert_ne!(reader.read(&root).unwrap().unwrap(), original);
    fs::write(root.join(".package-lock.json"), b"one").unwrap();
    fs::create_dir(root.join("added")).unwrap();
    assert_ne!(reader.read(&root).unwrap().unwrap(), original);
    fs::remove_dir(root.join("added")).unwrap();
    fs::create_dir(root.join("@scope/added")).unwrap();
    assert_ne!(reader.read(&root).unwrap().unwrap(), original);
    fs::remove_dir(root.join("@scope/added")).unwrap();
    fs::write(root.join("@scope/package/style.css"), b"a{color:red}").unwrap();
    assert_eq!(reader.read(&root).unwrap().unwrap(), original);
}

#[test]
fn oversized_install_records_decline_retention_without_reading_the_payload() {
    let temporary = tempfile::tempdir().unwrap();
    let root = temporary.path().join("node_modules");
    fs::create_dir(&root).unwrap();
    fs::File::create(root.join(".modules.yaml"))
        .unwrap()
        .set_len(Limits::default().bytes as u64 + 1)
        .unwrap();
    let reader: &dyn InstallInputs = &SystemInstallInputs {
        cancellation: Arc::new(Token::default()),
    };
    assert_eq!(reader.read(&root).unwrap(), None);
}
