//! Unrelated disappearance and unreadable children do not fail source capture.

use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::filesystem::{Entry, FilesMock, Identity};
use crate::fingerprint::{Fingerprints, SourceFingerprints};

#[test]
fn vanished_and_unreadable_children_have_stable_membership() {
    let mocks = Unimock::new((
        FilesMock::project
            .next_call(matching!(_))
            .returns(Ok("/repo".into())),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo")))
            .returns(Ok(Some(Entry::Directory(Identity {
                native: (1, 1),
                created: None,
            })))),
        FilesMock::children.next_call(matching!(_)).returns(Ok(vec![
            "/repo/vanished".into(),
            "/repo/locked".into(),
            "/repo/private".into(),
        ])),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/vanished")))
            .returns(Ok(None)),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/locked")))
            .returns(Ok(Some(Entry::File(1)))),
        FilesMock::hash
            .next_call(matching!(_))
            .returns(Err(Error::Unexpected {
                path: "/repo/locked".into(),
            })),
        FilesMock::entry
            .next_call(matching!((path) if *path == Path::new("/repo/private")))
            .returns(Ok(Some(Entry::Directory(Identity {
                native: (1, 2),
                created: None,
            })))),
        FilesMock::children
            .next_call(matching!(_))
            .returns(Err(Error::Unexpected {
                path: "/repo/private".into(),
            })),
    ));
    let result = SourceFingerprints {
        files: Arc::new(mocks),
    }
    .capture(Path::new("/repo"), &[])
    .unwrap();
    assert!(!result.contains_key(Path::new("/repo/vanished")));
    assert_eq!(result[Path::new("/repo/locked")], "unreadable");
    assert_eq!(result[Path::new("/repo/private")], "unreadable");
}
