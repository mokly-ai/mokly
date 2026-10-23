//! Raw batch framing uses proved lengths and preserves arbitrary payload bytes.

use crate::checkout_output::decode_batch;
use crate::error::Error;
use crate::identity::{ObjectId, RepoPath};
use crate::tree::{Entry, Mode};

fn entry() -> Entry {
    Entry {
        path: RepoPath::parse("file").unwrap(),
        object: ObjectId::parse(&"a".repeat(40)).unwrap(),
        mode: Mode::File,
        size: 4,
    }
}

#[test]
fn proved_lengths_preserve_binary_payloads() {
    let entry = entry();
    let output = [
        format!("{} blob 4\0", entry.object).as_bytes(),
        &[0, 255, 10, 13, 0],
    ]
    .concat();
    assert_eq!(
        decode_batch(&output, std::slice::from_ref(&entry), 4).unwrap(),
        [&[0, 255, 10, 13][..]]
    );
    assert!(matches!(
        decode_batch(&output, &[entry], 3),
        Err(Error::ByteLimit { limit: 3 })
    ));
}

#[test]
fn truncated_wrong_and_extra_records_never_supply_bytes() {
    let entry = entry();
    for output in [
        format!("{} blob 2\0a\0", entry.object).into_bytes(),
        format!("{} tree 0\0\0", entry.object).into_bytes(),
        format!("{} blob invalid\0\0", entry.object).into_bytes(),
        format!("{} blob 1\0a\0extra", entry.object).into_bytes(),
        format!("{} blob 0\0\0", "b".repeat(40)).into_bytes(),
        b"missing header".to_vec(),
    ] {
        assert!(matches!(
            decode_batch(&output, std::slice::from_ref(&entry), 100),
            Err(Error::MalformedOutput)
        ));
    }
}
