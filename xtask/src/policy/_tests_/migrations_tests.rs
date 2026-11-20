//! Migration lock corruption, layout, and baseline fixtures.

use std::path::PathBuf;

use crate::policy::diagnostic::Violation;

use super::{checksum, validate};

fn files(timestamp: &str) -> Vec<(PathBuf, Vec<u8>)> {
    ["down.sql", "up.sql"]
        .into_iter()
        .map(|name| {
            (
                PathBuf::from(format!(
                    "crates/mkc-db/migrations/{timestamp}_create/{name}"
                )),
                b"SELECT 1;\n".to_vec(),
            )
        })
        .collect()
}

fn lock(files: &[(PathBuf, Vec<u8>)]) -> String {
    let mut text = "# Migration checksums\n".to_owned();
    for (path, bytes) in files {
        text.push_str(&format!(
            "fnv1a64:{:016x} {}\n",
            checksum(bytes),
            path.display()
        ));
    }
    text
}

#[test]
fn fnv_matches_known_vectors() {
    assert_eq!(checksum(b""), 0xcbf29ce484222325);
    assert_eq!(checksum(b"hello"), 0xa430d84680aabd0b);
}

#[test]
fn accepts_empty_repository_and_append_only_pairs() {
    assert!(validate("", "", &[]).is_empty());
    let mut all = files("202609141200");
    let baseline = lock(&all);
    all.extend(files("202609141201"));
    assert!(validate(&lock(&all), &baseline, &all).is_empty());
}

#[test]
fn rejects_changed_removed_and_unlocked_files() {
    let mut all = files("202609141200");
    let original = lock(&all);
    all[0].1 = b"SELECT 2;\n".to_vec();
    assert!(
        validate(&original, "", &all)
            .iter()
            .any(|v| matches!(v, Violation::ChangedMigration(_)))
    );
    assert!(
        validate(&original, "", &all[1..])
            .iter()
            .any(|v| matches!(v, Violation::ChangedMigration(_)))
    );
    assert!(
        validate("", "", &all)
            .iter()
            .any(|v| matches!(v, Violation::UnlockedMigration(_)))
    );
}

#[test]
fn changing_both_sql_and_lock_cannot_evade_origin_main() {
    let mut all = files("202609141200");
    let baseline = lock(&all);
    all[0].1 = b"SELECT 2;\n".to_vec();
    assert!(
        validate(&lock(&all), &baseline, &all)
            .iter()
            .any(|v| matches!(v, Violation::ChangedBaseline(_)))
    );
    assert!(
        validate("", &baseline, &[])
            .iter()
            .any(|v| matches!(v, Violation::ChangedBaseline(_)))
    );
}

#[test]
fn rejects_old_timestamp_insertions_and_missing_sql_pairs() {
    let mut all = files("202609141200");
    let baseline = lock(&all);
    let mut earlier = files("202609131200");
    earlier.extend(all.clone());
    assert!(
        validate(&lock(&earlier), &baseline, &earlier)
            .iter()
            .any(|v| matches!(v, Violation::ChangedBaseline(_)))
    );
    all.remove(0);
    assert!(
        validate(&lock(&all), "", &all)
            .iter()
            .any(|v| matches!(v, Violation::MigrationLayout(_)))
    );
}

#[test]
fn rejects_malformed_unsorted_duplicate_and_headerless_locks() {
    let all = files("202609141200");
    let valid = lock(&all);
    for text in [
        valid.replace("fnv1a64:", "sha256:"),
        valid.replace("202609141200", "20260914"),
        valid.replace("# Migration checksums\n", ""),
        lock(&[all[1].clone(), all[0].clone()]),
        lock(&[all[0].clone(), all[0].clone()]),
    ] {
        assert!(!validate(&text, "", &all).is_empty());
    }
    assert!(!validate("", "", &files("invalid")).is_empty());
}
