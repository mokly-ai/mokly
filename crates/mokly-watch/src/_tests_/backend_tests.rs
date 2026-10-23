//! Vanished platform errors use source projection without hiding errors for live directories.

use std::io;
use std::path::Path;

use mokly_source_interface::tree::{FileKind, Node, SourceTreeMock};
use unimock::{MockFn, Unimock, matching};

use super::vanished;

#[test]
fn watch_not_found_races_do_not_turn_into_candidate_failures() {
    let unused = Unimock::new(());
    let path = Path::new("/repo/specs");
    assert!(vanished(&notify::Error::path_not_found(), &unused, path));
    for kind in [io::ErrorKind::NotFound, io::ErrorKind::NotADirectory] {
        assert!(vanished(
            &notify::Error::io(io::Error::from(kind)),
            &unused,
            path
        ));
    }
    for kind in [None, Some(FileKind::File), Some(FileKind::Directory)] {
        for error in [
            notify::Error::generic("Input watch path is neither a file nor a directory."),
            notify::Error::io(io::Error::from(io::ErrorKind::PermissionDenied)),
        ] {
            let source = Unimock::new(SourceTreeMock::project.next_call(matching!(_)).returns(Ok(
                kind.map(|kind| Node {
                    identity: path.into(),
                    kind,
                    lexical_kind: kind,
                }),
            )));
            assert_eq!(
                vanished(&error, &source, path),
                kind != Some(FileKind::Directory)
            );
        }
    }
}
