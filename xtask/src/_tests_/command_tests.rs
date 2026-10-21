//! Command display and platform program selection stay independent.

use std::ffi::OsStr;
use std::path::Path;

use super::{CommandSpec, build_command, program_for_platform};

#[test]
fn node_command_shims_resolve_for_each_supported_operating_system() {
    for program in ["npm", "npx", "corepack", "pnpm", "pnpx", "yarn", "yarnpkg"] {
        assert_eq!(
            program_for_platform(program, "windows"),
            format!("{program}.cmd")
        );
        for os in ["linux", "macos"] {
            assert_eq!(program_for_platform(program, os), program);
        }
    }
}

#[test]
fn executable_names_and_explicit_paths_are_preserved_on_every_platform() {
    for os in ["linux", "macos", "windows"] {
        for program in [
            "node",
            "node.exe",
            "cargo",
            "git",
            "npm.cmd",
            "npx.cmd",
            "/tools/npm",
            "C:\\tools\\npm.cmd",
            "custom-tool",
        ] {
            assert_eq!(program_for_platform(program, os), program);
        }
    }
}

#[test]
fn host_command_resolves_the_shim_without_changing_its_arguments() {
    for program in ["npm", "npx", "corepack", "pnpm", "pnpx", "yarn", "yarnpkg"] {
        let spec = CommandSpec::new(program).args(["run", "script with spaces"]);
        let command = build_command(&spec);
        let expected = if cfg!(windows) {
            format!("{program}.cmd")
        } else {
            program.into()
        };
        assert_eq!(command.get_program(), OsStr::new(&expected));
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            [OsStr::new("run"), OsStr::new("script with spaces")]
        );
        assert_eq!(
            spec.display(),
            format!("{program} run \"script with spaces\"")
        );
    }
}

#[test]
fn display_quotes_arguments_with_spaces() {
    let command = CommandSpec::new("npm").args(["run", "an odd script"]);

    assert_eq!(command.display(), "npm run \"an odd script\"");
}

#[test]
fn command_carries_workspace_directory_without_changing_display() {
    let command = CommandSpec::new("npm")
        .args(["run", "lint"])
        .in_directory("/workspace");
    assert_eq!(command.working_directory(), Some(Path::new("/workspace")));
    assert_eq!(command.display(), "npm run lint");
}
