//! PATH search resolves platform programs and continues after metadata failures.

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
                assert_eq!(path, Path::new("not-a-directory").join(blacksmith()));
                Err(Error::Io {
                    operation: Operation::Program,
                    source: io::Error::from(ErrorKind::NotADirectory),
                })
            }),
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("unreadable").join(blacksmith()));
                Err(Error::Io {
                    operation: Operation::Program,
                    source: io::Error::from(ErrorKind::PermissionDenied),
                })
            }),
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers(&|_, path| {
                assert_eq!(path, Path::new("bin").join(blacksmith()));
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
            let name = if cfg!(windows) { "gh.exe" } else { "gh" };
            assert_eq!(path, Path::new("unreadable").join(name));
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

fn blacksmith() -> &'static str {
    if cfg!(windows) {
        "blacksmith.exe"
    } else {
        "blacksmith"
    }
}

fn finds_only(os: &str, name: &str, installed: &'static str) {
    let environment = Unimock::new(
        EnvironmentGetMock
            .next_call(matching!("PATH"))
            .returns(Some("bin".into())),
    );
    let files = Unimock::new(
        ProgramFilesExecutableMock
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, path| {
                Ok(path == Path::new("bin").join(installed))
            })),
    );
    let programs = SystemPrograms {
        environment: Arc::new(environment),
        files: Arc::new(files),
    };
    assert!(
        programs.find_for_platform(name, os).unwrap(),
        "{os} must discover {installed} for {name}"
    );
}

#[test]
fn windows_lookup_finds_installed_native_executables() {
    for (name, installed) in [
        ("blacksmith", "blacksmith.exe"),
        ("rsync", "rsync.exe"),
        ("ssh", "ssh.exe"),
        ("gh", "gh.exe"),
        ("node", "node.exe"),
    ] {
        finds_only("windows", name, installed);
    }
}

#[test]
fn windows_lookup_uses_the_node_shims_selected_for_execution() {
    for (name, installed) in [
        ("npm", "npm.cmd"),
        ("npx", "npx.cmd"),
        ("corepack", "corepack.cmd"),
        ("pnpm", "pnpm.cmd"),
        ("pnpx", "pnpx.cmd"),
        ("yarn", "yarn.cmd"),
        ("yarnpkg", "yarnpkg.cmd"),
    ] {
        finds_only("windows", name, installed);
    }
}

#[test]
fn lookup_keeps_explicit_extensions_and_unix_program_names() {
    for name in ["blacksmith.exe", "npm.cmd", "ssh.EXE"] {
        finds_only("windows", name, name);
    }
    for os in ["linux", "macos"] {
        for name in ["blacksmith", "rsync", "ssh", "gh", "node", "npm", "npx"] {
            finds_only(os, name, name);
        }
    }
}
