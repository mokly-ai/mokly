//! Command display matches the drawings and quotes only unsafe arguments.

use crate::command::{Command, REPO, args};

#[test]
fn display_keeps_plain_arguments_unquoted() {
    let command = Command::new("git", args(&["init", "--quiet", REPO]), "/workspace");
    assert_eq!(command.display(), "$ git init --quiet /workspace/repo\n");

    let command = Command::new(
        "AZaz09@%+=:,./_-",
        args(&[
            "--package=@mokly/mokly@0.19.0",
            "+refs/heads/main:origin/main",
        ]),
        REPO,
    );
    assert_eq!(
        command.display(),
        "$ AZaz09@%+=:,./_- --package=@mokly/mokly@0.19.0 +refs/heads/main:origin/main\n"
    );
}

#[test]
fn display_quotes_the_credential_helper_like_the_drawing() {
    let command = Command::new(
        "git",
        args(&[
            "config",
            "--local",
            "credential.helper",
            "store --file=/home/user/.mokly-git-credentials",
        ]),
        REPO,
    );
    assert_eq!(
        command.display(),
        "$ git config --local credential.helper 'store --file=/home/user/.mokly-git-credentials'\n"
    );
}

#[test]
fn display_quotes_characters_outside_the_plain_set() {
    for value in [
        "two words",
        "line\nbreak",
        "tab\there",
        "$HOME",
        "a;b",
        "*",
        "é",
        "\\",
        "\"",
        "?",
    ] {
        let command = Command::new("tool name", args(&[value]), REPO);
        assert_eq!(command.display(), format!("$ 'tool name' '{value}'\n"));
    }
}

#[test]
fn display_quotes_empty_arguments() {
    let command = Command::new("tool", args(&[""]), REPO);
    assert_eq!(command.display(), "$ tool ''\n");
}

#[test]
fn display_escapes_apostrophes_without_changing_argv() {
    let command = Command::new("tool", args(&["feature/user's-build"]), REPO);
    assert_eq!(command.display(), "$ tool 'feature/user'\\''s-build'\n");
    assert_eq!(command.args, ["feature/user's-build"]);
}
