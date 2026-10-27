//! The fingerprint value format, the path listing, and the record hash.

use sha2::{Digest, Sha256};

use crate::source_tree::error::Error;

use super::{Mode, Record, SourceFingerprint, fingerprint_records, source_paths};

const FORMAT: &str =
    "[xtask/source-tree] expected fingerprint must match sha256:<64 lowercase hex digits>";

#[test]
fn fingerprint_records_have_the_specified_nul_framing_and_sha256_digests() {
    let digest = Sha256::digest(b"hello\n")
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let record = Record {
        mode: Mode::Regular,
        path: b"file.txt".to_vec(),
        digest,
    };
    assert_eq!(
        record,
        Record::new(Mode::Regular, b"file.txt".to_vec(), b"hello\n")
    );
    assert_eq!(
        fingerprint_records(&[record]).to_string(),
        "sha256:e26c5151471b79c7bcbe0c02e035ce212514fd62e45b05a8a56c32e3f20fd432"
    );
    assert_eq!(
        fingerprint_records(&[]).to_string(),
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
}

#[test]
fn path_listing_removes_duplicates_and_sorts_raw_bytes_without_decoding() {
    assert_eq!(
        source_paths(&[0xff, 0, 0x61, 0, 0xc3, 0xa9, 0, 0x61, 0]),
        [b"a".to_vec(), "é".as_bytes().to_vec(), vec![0xff]]
    );
    assert_eq!(source_paths(&[]), Vec::<Vec<u8>>::new());
}

#[test]
fn record_ordering_uses_unsigned_path_bytes() {
    let records = [
        Record::new(Mode::Symlink, vec![0xff], b"target"),
        Record::new(Mode::Executable, "é".as_bytes().to_vec(), b"two"),
        Record::new(Mode::Regular, b"a".to_vec(), b"one"),
    ];
    assert_eq!(
        fingerprint_records(&records).to_string(),
        "sha256:e48f5d627a219b39e7532c68cee17c1744fe04dbd8f1c04e5ff6c467344d8756"
    );
}

#[test]
fn the_fingerprint_validator_accepts_the_exact_value_and_has_no_usage_text() {
    let valid = format!("sha256:{}", "a".repeat(64));
    assert_eq!(SourceFingerprint::parse(&valid).unwrap().to_string(), valid);
    for value in [
        String::new(),
        "invalid".to_owned(),
        format!("{valid}\n"),
        format!("sha256:{}", "A".repeat(64)),
        format!("sha256:{}", "a".repeat(63)),
        format!("sha1:{}", "a".repeat(64)),
    ] {
        let error = SourceFingerprint::parse(&value).unwrap_err();
        assert!(matches!(error, Error::Format), "{value:?}");
        assert_eq!(error.to_string(), FORMAT);
        assert!(!error.to_string().contains("usage"));
    }
}
