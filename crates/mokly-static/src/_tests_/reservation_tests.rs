//! Partial transaction marker setup retains both operation and cleanup causes.

use std::path::Path;

use unimock::{MockFn, Unimock, matching};

use crate::error::Error;
use crate::filesystem::{Entry, FilesMock, Identity};
use crate::reservation;

#[test]
fn partial_marker_setup_cleans_once_and_preserves_failure_precedence() {
    for cleanup_fails in [false, true] {
        let directory = Entry::Directory(Identity {
            native: (1, 1),
            created: None,
        });
        let file = Entry::File(29);
        let mock = Unimock::new((
            FilesMock::entry
                .next_call(matching!((path) if *path==Path::new("/repo")))
                .returns(Ok(Some(directory.clone()))),
            FilesMock::entry
                .next_call(
                    matching!((path) if *path==Path::new("/repo/.mokly-export-reservations")),
                )
                .returns(Ok(Some(directory.clone()))),
            FilesMock::entry
                .next_call(matching!(_))
                .returns(Ok(Some(directory.clone()))),
            FilesMock::entry
                .next_call(matching!(_))
                .returns(Ok(Some(file.clone()))),
            FilesMock::read
                .next_call(matching!(_, _))
                .returns(Ok(b"mokly-export-reservations-v1\n".to_vec())),
            FilesMock::entry
                .next_call(matching!(_))
                .returns(Ok(Some(directory.clone()))),
            FilesMock::mkdir.next_call(matching!(_)).returns(Ok(())),
            FilesMock::write
                .next_call(matching!(_, _))
                .returns(Err(Error::Invalid {
                    path: "primary".into(),
                })),
            FilesMock::entry
                .next_call(matching!(_))
                .returns(Ok(Some(directory))),
            FilesMock::entry.next_call(matching!(_)).returns(Ok(None)),
            FilesMock::remove_stage
                .next_call(matching!(_))
                .returns(Ok(())),
            FilesMock::entry
                .next_call(matching!(_))
                .returns(Ok(Some(file))),
            FilesMock::unlink.next_call(matching!(_)).returns(Ok(())),
            FilesMock::rmdir
                .next_call(matching!(_))
                .returns(if cleanup_fails {
                    Err(Error::Unexpected {
                        path: "/kept".into(),
                    })
                } else {
                    Ok(())
                }),
        ));
        let error = reservation::acquire(&mock, Path::new("/repo/site")).unwrap_err();
        if cleanup_fails {
            let Error::Recovery {
                primary,
                cleanup,
                path,
            } = error
            else {
                panic!("combined failure required")
            };
            assert!(matches!(*primary, Error::Invalid { path } if path=="primary"));
            assert!(matches!(*cleanup, Error::Unexpected { .. }));
            assert!(path.ends_with("locks/site"));
        } else {
            assert!(matches!(error, Error::Invalid { path } if path=="primary"));
        }
    }
}
