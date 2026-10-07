//! Real PATH candidates and failed filesystem access without executing them.

use std::env;
use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::Path;
use std::sync::Arc;

use unimock::{MockFn, Unimock, matching};

use crate::remote::adapter_support::TestDirectory;
use crate::remote::contracts::{EnvironmentGetMock, Programs};
use crate::remote::error::{Error, Operation};
use crate::remote::runtime::{ProgramFiles, SystemProgramFiles, SystemPrograms};

fn programs(paths: &[&Path]) -> SystemPrograms {
    let path = env::join_paths(paths).unwrap().into_string().unwrap();
    SystemPrograms {
        environment: Arc::new(Unimock::new(
            EnvironmentGetMock
                .each_call(matching!("PATH"))
                .returns(Some(path)),
        )),
        files: Arc::new(SystemProgramFiles),
    }
}

#[test]
fn accepts_executable_files_and_rejects_plain_files_and_directories() {
    let directory = TestDirectory::new();
    let executable = directory.path().join("executable");
    let plain = directory.path().join("plain");
    fs::write(&executable, "#!/bin/sh\nexit 99\n").unwrap();
    fs::write(&plain, "not executable").unwrap();
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
    fs::set_permissions(&plain, fs::Permissions::from_mode(0o600)).unwrap();
    assert!(SystemProgramFiles.executable(&executable).unwrap());
    assert!(!SystemProgramFiles.executable(&plain).unwrap());
    assert!(!SystemProgramFiles.executable(directory.path()).unwrap());
    let programs = programs(&[directory.path()]);
    assert!(programs.find("executable").unwrap());
    assert!(!programs.find("plain").unwrap());
    assert!(!programs.find("missing").unwrap());
}

#[test]
fn skips_an_unreadable_path_entry_and_finds_the_next_executable() {
    let directory = TestDirectory::new();
    let denied = directory.path().join("denied");
    let bin = directory.path().join("bin");
    symlink("denied", &denied).unwrap();
    fs::create_dir(&bin).unwrap();
    let executable = bin.join("blacksmith");
    fs::write(&executable, "#!/bin/sh\nexit 99\n").unwrap();
    fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
    let error = SystemProgramFiles
        .executable(&denied.join("blacksmith"))
        .unwrap_err();
    assert!(matches!(
        error,
        Error::Io {
            operation: Operation::Program,
            ..
        }
    ));
    assert!(programs(&[&denied, &bin]).find("blacksmith").unwrap());
    assert!(!programs(&[&denied]).find("blacksmith").unwrap());
}
