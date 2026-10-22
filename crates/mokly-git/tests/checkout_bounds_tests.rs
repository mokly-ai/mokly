//! Converted reads preserve binary paths, file modes, and selected byte bounds.

use mokly_git::error::Error;
use mokly_git::identity::RepoPath;
use mokly_git::tree::Limits;

mod support;
use support::Fixture;

#[test]
fn converted_batches_keep_binary_bytes_and_newlines_in_paths() {
    let fixture = Fixture::new();
    let bytes = [0, 255, 10, 9, 13];
    // Windows rejects a newline in a file name, so only the other hosts keep
    // that case. Every host keeps the binary bytes and the byte limit.
    let name = if cfg!(windows) {
        "specs/a-file"
    } else {
        "specs/a\nfile"
    };
    fixture.write(name, &bytes);
    let base = fixture.commit();
    let repository = fixture.repository();
    let path = RepoPath::parse(name).unwrap();
    assert_eq!(repository.read(&base, &path, bytes.len()).unwrap(), bytes);
    let entries = repository
        .lookup(&base, &[path], Limits::default())
        .unwrap();
    let error = repository
        .read_many(
            &base,
            &entries,
            Limits {
                blob: bytes.len() - 1,
                ..Limits::default()
            },
        )
        .unwrap_err();
    assert!(matches!(error, Error::ByteLimit { limit: 4 }));
}

#[cfg(unix)]
#[test]
fn symlink_sources_remain_nonregular() {
    let fixture = Fixture::new();
    fixture.write("target.txt", b"target");
    std::os::unix::fs::symlink("target.txt", fixture.root().join("link.txt")).unwrap();
    let base = fixture.commit();
    assert!(matches!(
        fixture
            .repository()
            .read(&base, &RepoPath::parse("link.txt").unwrap(), 64),
        Err(Error::NotRegular { .. })
    ));
}

#[cfg(unix)]
#[test]
fn expanding_filters_are_unavailable_at_the_selected_bound() {
    let fixture = Fixture::new();
    fixture.write(".gitattributes", b"value filter=expand\n");
    fixture.write("value", b"x");
    let base = fixture.commit();
    fixture.git(&["config", "filter.expand.smudge", "printf 123456789"]);
    fixture.git(&["config", "filter.expand.required", "true"]);
    let error = fixture
        .repository()
        .read(&base, &RepoPath::parse("value").unwrap(), 8)
        .unwrap_err();
    assert!(
        matches!(error, Error::Conversion { source, .. } if matches!(*source, Error::ByteLimit { limit: 8 }))
    );
}
