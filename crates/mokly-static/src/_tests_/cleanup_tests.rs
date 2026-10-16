//! Cleanup never recursively removes a backup or an unlisted late directory.

use std::path::{Path, PathBuf};

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::filesystem::{Entry, FilesMock, Identity};
use crate::ownership::{self, Owned};
use crate::reservation;

#[test]
fn dangling_backup_blocks_reservation_cleanup_before_any_deletion() {
    let files = Unimock::new((
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/lock")))
            .returns(Ok(Some(Entry::Directory(Identity {
                native: (1, 2),
                created: None,
            })))),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/lock/backup")))
            .returns(Ok(Some(Entry::Unsafe))),
    ));
    assert!(
        matches!(reservation::cleanup(&files, Path::new("/lock")), Err(Error::Unexpected { path }) if path == Path::new("/lock/backup"))
    );
}

#[test]
fn a_late_child_stops_bounded_disposal_and_keeps_the_marker() {
    let files = Unimock::new((
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/backup/dir/owned")))
            .returns(Ok(Some(Entry::File(3)))),
        FilesMock::unlink
            .next_call(matching!((path) if *path == Path::new("/backup/dir/owned")))
            .returns(Ok(())),
        FilesMock::rmdir
            .next_call(matching!((path) if *path == Path::new("/backup/dir")))
            .returns(Err(Error::Unexpected {
                path: "/backup/dir/late".into(),
            })),
    ));
    let owned = Owned {
        identity: Identity {
            native: (1, 2),
            created: None,
        },
        files: vec![PathBuf::from("/backup/dir/owned")],
        directories: vec![PathBuf::from("/backup/dir")],
        marker: true,
    };
    assert!(
        matches!(ownership::dispose(&files, Path::new("/backup"), owned), Err(Error::Unexpected { path }) if path == Path::new("/backup/dir/late"))
    );
}
