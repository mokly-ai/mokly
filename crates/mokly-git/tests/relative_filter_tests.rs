//! Configured checkout filters keep their repository working-directory context.

#![cfg(unix)]

use std::fs;

use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;
use sha2::{Digest, Sha256};

mod support;
use support::Fixture;

#[test]
fn relative_filters_match_for_bytes_batches_digests_and_extraction() {
    let fixture = Fixture::new();
    fixture.write("smudge.sh", b"#!/bin/sh\ncat prefix.txt\ncat\n");
    fixture.write("prefix.txt", b"from checkout\n");
    fixture.write(".gitattributes", b"*.filtered filter=relative\n");
    fixture.write("a.filtered", b"a\n");
    fixture.write("dir/b.filtered", b"b\n");
    fixture.git(&["config", "filter.relative.clean", "cat"]);
    fixture.git(&["config", "filter.relative.smudge", "sh ./smudge.sh"]);
    fixture.git(&["config", "filter.relative.required", "true"]);
    let base = fixture.commit();
    let before = fixture.git(&["status", "--porcelain", "--untracked-files=all"]);
    let index = fixture.git(&["write-tree"]);
    let repository = fixture.repository();
    let paths = [
        RepoPath::parse("a.filtered").unwrap(),
        RepoPath::parse("dir/b.filtered").unwrap(),
    ];
    let entries = repository.lookup(&base, &paths, Limits::default()).unwrap();
    let expected = b"from checkout\na\n";
    assert_eq!(repository.read(&base, &paths[0], 128).unwrap(), expected);
    assert_eq!(
        repository
            .read_many(&base, &entries, Limits::default())
            .unwrap(),
        [expected.to_vec(), b"from checkout\nb\n".to_vec()]
    );
    let digest = Sha256::digest(expected)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    assert_eq!(repository.digest(&base, &entries[0]).unwrap(), digest);
    for (result, expected) in repository
        .digest_many(&base, &entries)
        .into_iter()
        .zip([expected.as_slice(), b"from checkout\nb\n".as_slice()])
    {
        let result = result.unwrap();
        let hash: String = Sha256::digest(expected)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        assert_eq!(result.digest, hash);
        assert_eq!(result.length, expected.len());
    }
    let temporary = tempfile::tempdir().unwrap();
    let destination = temporary.path().join("sources");
    repository
        .extract(&base, &destination, Limits::default())
        .unwrap();
    assert_eq!(fs::read(destination.join("a.filtered")).unwrap(), expected);
    assert_eq!(fixture.git(&["write-tree"]), index);
    assert_eq!(
        fixture.git(&["status", "--porcelain", "--untracked-files=all"]),
        before
    );
}

#[test]
fn attribute_values_named_unset_are_still_filter_drivers() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"file filter=unset\n");
    fixture.write("file", b"input");
    let base = fixture.commit();
    fixture.git(&["config", "filter.unset.smudge", "printf converted"]);
    assert_eq!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("file").unwrap(), 64)
            .unwrap(),
        b"converted"
    );
}
