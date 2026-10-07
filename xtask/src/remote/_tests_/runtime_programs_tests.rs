//! PATH search continues after candidate metadata failures.

use std::env;
use std::io::{self, ErrorKind};
use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::contracts::{EnvironmentGetMock, Programs};
use crate::remote::error::{Error, Operation};
use crate::remote::runtime::{ProgramFilesExecutableMock, SystemPrograms};

#[test]
fn path_lookup_skips_file_and_unreadable_entries_before_a_program() {
    let path = env::join_paths(["not-a-directory", "unreadable", "bin"])
        .unwrap()
        .into_string()
        .unwrap();
    let environment = Unimock::new(
        EnvironmentGetMock
            .next_call(matching!("PATH"))
            .returns(Some(path)),
    );
    let files = Unimock::new((
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("not-a-directory").join("blacksmith"));
                Err(Error::Io {
                    operation: Operation::Program,
                    source: io::Error::from(ErrorKind::NotADirectory),
                })
            }),
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("unreadable").join("blacksmith"));
                Err(Error::Io {
                    operation: Operation::Program,
                    source: io::Error::from(ErrorKind::PermissionDenied),
                })
            }),
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("bin").join("blacksmith"));
                Ok(true)
            }),
    ));
    let programs = SystemPrograms {
        environment: Arc::new(environment),
        files: Arc::new(files),
    };

    assert!(programs.find("blacksmith").unwrap());
}

#[test]
fn path_lookup_returns_absent_when_every_candidate_lookup_fails() {
    let environment = Unimock::new(
        EnvironmentGetMock
            .next_call(matching!("PATH"))
            .returns(Some("unreadable".to_owned())),
    );
    let files = Unimock::new(ProgramFilesExecutableMock.next_call(matching!(_)).answers(
        &|_, path| {
            assert_eq!(path, Path::new("unreadable").join("gh"));
            Err(Error::Io {
                operation: Operation::Program,
                source: io::Error::from(ErrorKind::InvalidData),
            })
        },
    ));
    let programs = SystemPrograms {
        environment: Arc::new(environment),
        files: Arc::new(files),
    };

    assert!(!programs.find("gh").unwrap());
}
