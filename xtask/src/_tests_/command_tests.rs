use std::path::Path;

use super::CommandSpec;

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
