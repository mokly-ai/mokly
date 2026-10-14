//! End-to-end binary exit statuses and stream contracts.

use std::process::{Command, Output};

fn run(args: &[&str], mode: &str) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mokly"))
        .args(args)
        .env("MOKLY_OUTPUT", mode)
        .env_remove("MOKLY_SIDECARS")
        .env_remove("MOKLY_ENDPOINT")
        .env_remove("MOKLY_TOKEN")
        .output()
        .unwrap()
}

#[test]
fn help_and_version_work_in_every_mode_and_subcommand() {
    for mode in ["plain", "rich"] {
        for args in [
            vec!["--help"],
            vec!["serve", "--help"],
            vec!["build", "--help"],
            vec!["publish", "--help"],
            vec!["--version"],
        ] {
            let output = run(&args, mode);
            assert_eq!(output.status.code(), Some(0));
            assert!(output.stderr.is_empty());
            assert!(!output.stdout.contains(&0x1b));
        }
    }
}

#[test]
fn absent_subsystems_fail_with_exactly_one_line_and_no_stack() {
    for args in [
        vec![],
        vec!["serve"],
        vec!["build"],
        vec![
            "publish",
            "--endpoint=https://example.com/plan",
            "--token=SECRET",
        ],
    ] {
        let output = run(&args, "rich");
        assert_eq!(output.status.code(), Some(1));
        assert!(output.stdout.is_empty());
        let error = String::from_utf8(output.stderr).unwrap();
        assert_eq!(error.lines().count(), 1);
        assert!(error.contains("is not available in this build."));
        assert!(!error.contains("SECRET"));
    }
}

#[test]
fn invalid_commands_exit_one_and_do_not_echo_secrets() {
    let output = run(
        &["publish", "--token=secret/a==", "--unknown=secret/a=="],
        "plain",
    );
    assert_eq!(output.status.code(), Some(1));
    let error = String::from_utf8(output.stderr).unwrap();
    assert!(error.starts_with("[mokly/cli-invalid] "));
    assert!(!error.contains("secret/a=="));
    assert!(!error.contains("stack"));
    let output = run(&["serve", "--strict"], "plain");
    assert_eq!(
        String::from_utf8(output.stderr).unwrap(),
        "[mokly/cli-invalid] --strict belongs to build or publish\n"
    );
}
